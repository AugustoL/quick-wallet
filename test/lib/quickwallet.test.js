const { BN, time, balance } = require('openzeppelin-test-helpers');
const { generateMnemonic, QuickWallet } = require('../../lib/dist');

const Create2 = artifacts.require('Create2');
const WalletFactory = artifacts.require('WalletFactory');
const Wallet = artifacts.require('Wallet');
const ERC20Mock = artifacts.require('ERC20Mock');

contract('QuickWallet Lib', function ([_, tokenOwner, walletOwner, relayer, otherAccount]) {
  const walletBytecode = Wallet.bytecode;

  beforeEach(async function () {
    const create2Lib = await Create2.new();
    await WalletFactory.link('Create2', create2Lib.address);
    this.factory = await WalletFactory.new(walletBytecode);
    this.token = await ERC20Mock.new(tokenOwner, 100);
  });

  it('should create a wallet using QuickWallet', async function () {
    const quickWallet = QuickWallet.fromMnemonic(generateMnemonic(), this.factory.address);
    quickWallet.generateAddresses(1);

    const newWallet = quickWallet.getWallets()[0];
    await web3.eth.sendTransaction({ from: tokenOwner, to: newWallet.address, value: 100 });

    const balanceTrackerOtherAccount = await balance.tracker(otherAccount);
    const balanceTrackerWallet = await balance.tracker(newWallet.address);

    const firstTxData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTime = (await time.latest()) + 60;
    const firstTxDataSigned = await quickWallet.sign(newWallet.owner,
      web3.utils.soliditySha3(
        newWallet.address, newWallet.address, firstTxData, newWallet.address, 1, 0, beforeTime
      )
    );
    await this.factory.deploy(
      newWallet.salt, newWallet.address, firstTxData, newWallet.address,
      relayer, 1, beforeTime, newWallet.owner, firstTxDataSigned, { from: relayer }
    );

    const wallet = await Wallet.at(newWallet.address);

    (await balanceTrackerOtherAccount.delta()).should.be.bignumber.equal(new BN(10));
    (await balanceTrackerWallet.get()).should.be.bignumber.equal(new BN(89));
    (await wallet.owner()).should.be.equal(web3.utils.toChecksumAddress(newWallet.owner));
  });

  it('should send transaction using QuickWallet', async function () {
    const quickWallet = QuickWallet.fromMnemonic(generateMnemonic(), this.factory.address);
    quickWallet.generateAddresses(1);

    const newWallet = quickWallet.getWallets()[0];
    await web3.eth.sendTransaction({ from: tokenOwner, to: newWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: newWallet.owner, value: web3.utils.toWei('1000') });

    const balanceTrackerOtherAccount = await balance.tracker(otherAccount);
    const balanceTrackerWallet = await balance.tracker(newWallet.address);

    const firstTxData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const firstTx = await quickWallet.sendTransaction({
      from: newWallet.address,
      to: newWallet.address,
      data: firstTxData,
      feeToken: newWallet.address,
      feeTo: newWallet.owner,
      gasPrice: 1,
      feeValue: 0,
      timeLimit: 60,
      chainId: 1977
    });

    const wallet = await Wallet.at(newWallet.address);

    (await balanceTrackerOtherAccount.delta()).should.be.bignumber.equal(new BN(10));
    (await balanceTrackerWallet.get()).should.be.bignumber.equal(new BN(90));
    (await wallet.owner()).should.be.equal(web3.utils.toChecksumAddress(newWallet.owner));
  });

  it('relay transaction using QuickWallet', async function () {
    const quickWallet = QuickWallet.fromMnemonic(generateMnemonic(), this.factory.address);
    quickWallet.generateAddresses(2);

    const senderWallet = quickWallet.getWallets()[0];
    const relayerWallet = quickWallet.getWallets()[0];
    await web3.eth.sendTransaction({ from: tokenOwner, to: senderWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: relayerWallet.owner, value: web3.utils.toWei('1000') });

    const balanceTrackerOtherAccount = await balance.tracker(otherAccount);
    const balanceTrackerWallet = await balance.tracker(senderWallet.address);

    const firstTxData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const firstTxSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.address,
      to: senderWallet.address,
      data: firstTxData,
      feeToken: senderWallet.address,
      feeTo: senderWallet.owner,
      feeValue: 0,
      timeLimit: 60,
    });

    await quickWallet.relayTransaction({
      from: relayerWallet.owner,
      quickTransaction: firstTxSigned,
      gasPrice: 1,
      chainId: 1977
    })

    const wallet = await Wallet.at(senderWallet.address);

    (await balanceTrackerOtherAccount.delta()).should.be.bignumber.equal(new BN(10));
    (await balanceTrackerWallet.get()).should.be.bignumber.equal(new BN(90));
    (await wallet.owner()).should.be.equal(web3.utils.toChecksumAddress(senderWallet.owner));
  });
});
