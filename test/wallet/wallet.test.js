const { BN, shouldFail, time } = require('openzeppelin-test-helpers');
const { generateMnemonic, EthHdWallet } = require('eth-hd-wallet');

const { buildCreate2Address } = require('../helpers/create2');
const { signMessage } = require('../helpers/sign');

const Create2 = artifacts.require('Create2');
const WalletFactory = artifacts.require('WalletFactory');
const Wallet = artifacts.require('Wallet');
const ERC20Mock = artifacts.require('ERC20Mock');

contract('Wallet', function ([_, tokenOwner, walletOwner, relayer, otherAccount]) {
  const walletBytecode = Wallet.bytecode;
  let saltHex;

  beforeEach(async function () {
    const create2Lib = await Create2.new();
    await WalletFactory.link('Create2', create2Lib.address);
    this.factory = await WalletFactory.new(walletBytecode);
    this.token = await ERC20Mock.new(tokenOwner, 100);
    saltHex = web3.utils.randomHex(32);

    this.deployWallet = async function (_salt, _tokenFee, _feeValue, _walletOwner, _timeLimit = 60) {
      const constructorData = web3.eth.abi.encodeParameters(['address'], [_walletOwner]);
      const feePaymentData = web3.eth.abi.encodeFunctionCall({
        name: 'transfer',
        type: 'frunction',
        inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
      }, [relayer, _feeValue]);
      const beforeTime = (await time.latest()) + _timeLimit;
      const walletAddress =
        buildCreate2Address(this.factory.address, _salt, walletBytecode + constructorData.substring(2));
      const feePaymentDataSigned = await signMessage(_walletOwner,
        web3.utils.soliditySha3(walletAddress, _tokenFee, feePaymentData, 0, beforeTime)
      );
      await this.factory.deploy(
        _salt, _tokenFee, _feeValue, beforeTime, _walletOwner, feePaymentDataSigned, { from: relayer }
      );
      return Wallet.at(walletAddress);
    };

    this.computeWalletAddress = async function (_salt, _walletOwner) {
      return buildCreate2Address(this.factory.address, _salt,
        walletBytecode + web3.eth.abi.encodeParameters(['address'], [_walletOwner]).substring(2)
      );
    };
  });

  it('should deploy a Wallet contract with correct owner and pay fee in tokens', async function () {
    const walletAddress = await this.computeWalletAddress(saltHex, walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const wallet = await this.deployWallet(saltHex, this.token.address, 30, walletOwner);

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(30));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(20));
    (await wallet.owner()).should.be.equal(walletOwner);
  });

  it('should deploy a Wallet contract with correct owner and pay fee in eth', async function () {
    const walletAddress = await this.computeWalletAddress(saltHex, walletOwner);
    await web3.eth.sendTransaction({ from: tokenOwner, to: walletAddress, value: 100 });
    const wallet = await this.deployWallet(saltHex, walletAddress, 80, walletOwner);

    (await web3.eth.getBalance(wallet.address)).should.be.equal('20');
    (await wallet.owner()).should.be.equal(walletOwner);
  });

  it('should transfer tokens and pay fee in tokens', async function () {
    const walletAddress = await this.computeWalletAddress(saltHex, walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const wallet = await this.deployWallet(saltHex, this.token.address, 30, walletOwner);

    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 19]);
    const beforeTime = (await time.latest()) + 60;
    const sendTokensDataSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(walletAddress, this.token.address, sendTokensData, this.token.address, 1, 1, beforeTime)
    );
    await wallet.call(
      this.token.address, sendTokensData, this.token.address, 1, beforeTime, sendTokensDataSig, { from: relayer }
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(31));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(19));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(0));
  });

  it('should protect a token transfer against replay', async function () {
    const walletAddress = await this.computeWalletAddress(saltHex, walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const wallet = await this.deployWallet(saltHex, this.token.address, 30, walletOwner);

    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 1]);
    const beforeTime = (await time.latest()) + 1000;
    const sendTokensDataSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(walletAddress, this.token.address, sendTokensData, this.token.address, 1, 1, beforeTime)
    );
    await wallet.call(
      this.token.address, sendTokensData, this.token.address, 1, beforeTime, sendTokensDataSig, { from: relayer }
    );

    await shouldFail.reverting(
      wallet.call(
        this.token.address, sendTokensData, this.token.address, 1, beforeTime, sendTokensDataSig, { from: relayer }
      )
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(31));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(1));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(18));
  });

  it('should protect a token transfer against tx replay with different fees in and time', async function () {
    const walletAddress = await this.computeWalletAddress(saltHex, walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const wallet = await this.deployWallet(saltHex, this.token.address, 30, walletOwner);

    const sendTokensDataHighfee = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTimeInHighFee = (await time.latest()) + 10;
    const sendTokensDataHighFeeSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(
        walletAddress, this.token.address, sendTokensDataHighfee, this.token.address, 3, 1,beforeTimeInHighFee
      )
    );
    const sendTokensDataLowFee = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTimeInLowFee = (await time.latest()) + 30;
    const sendTokensDataLowFeeSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(
        walletAddress, this.token.address, sendTokensDataLowFee, this.token.address, 1, 1, beforeTimeInLowFee
      )
    );
    await wallet.call(
      this.token.address, sendTokensDataHighfee, this.token.address, 3, beforeTimeInHighFee, sendTokensDataHighFeeSig, { from: relayer }
    );

    await shouldFail.reverting(
      wallet.call(
        this.token.address, sendTokensDataLowFee, this.token.address, 1, beforeTimeInLowFee, sendTokensDataLowFeeSig, { from: relayer }
      )
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(33));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(10));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(7));
  });

  it('should create a wallet using BIP44', async function () {
    const bip44Wallet = EthHdWallet.fromMnemonic(generateMnemonic());
    bip44Wallet.generateAddresses(1);
    web3.eth.accounts.wallet.add('0x' + bip44Wallet._children[0].wallet._privKey.toString('hex'));

    const walletOwner = web3.utils.toChecksumAddress(bip44Wallet.getAddresses()[0]);
    const saltFromBIP44 = web3.utils.sha3(bip44Wallet.getAddresses()[0]);
    const walletAddress = await this.computeWalletAddress(saltFromBIP44, walletOwner);
    await web3.eth.sendTransaction({ from: tokenOwner, to: walletAddress, value: 100 });
    const wallet = await this.deployWallet(saltFromBIP44, walletAddress, 80, walletOwner);

    (await web3.eth.getBalance(wallet.address)).should.be.equal('20');
    (await wallet.owner()).should.be.equal(walletOwner);
  });
});
