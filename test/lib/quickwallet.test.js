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

  it('should create a wallet using BIP44', async function () {
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
});
