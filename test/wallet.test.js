const { BN, shouldFail, time, balance } = require('openzeppelin-test-helpers');

const { buildCreate2Address } = require('./helpers/create2');
const { signMessage } = require('./helpers/sign');

const Create2 = artifacts.require('Create2');
const QuickWalletFactory = artifacts.require('QuickWalletFactory');
const QuickWallet = artifacts.require('QuickWallet');
const ERC20Mock = artifacts.require('ERC20Mock');

contract('QuickWallet', function ([_, tokenOwner, walletOwner, relayer, otherAccount]) {
  const walletBytecode = QuickWallet.bytecode;

  beforeEach(async function () {
    const create2Lib = await Create2.new();
    await QuickWalletFactory.link('Create2', create2Lib.address);
    this.factory = await QuickWalletFactory.new(walletBytecode);
    this.token = await ERC20Mock.new(tokenOwner, 100);

    this.computeWalletAddress = async function (_walletOwner) {
      return buildCreate2Address(this.factory.address, web3.utils.soliditySha3(_walletOwner),
        walletBytecode + web3.eth.abi.encodeParameters(['address'], [_walletOwner]).substring(2)
      );
    };

    this.deployQuickWallet = async function (
      _firstTxTo, _firstTxData, _tokenFee, _feeValue, _walletOwner, _timeLimit = 60
    ) {
      const constructorData = web3.eth.abi.encodeParameters(['address'], [_walletOwner]);
      const beforeTime = (await time.latest()) + _timeLimit;
      const walletAddress = await this.computeWalletAddress(_walletOwner);
      const feePaymentDataSigned = await signMessage(_walletOwner,
        web3.utils.soliditySha3(
          walletAddress, _firstTxTo, _firstTxData, _tokenFee, _feeValue, 0, beforeTime
        )
      );
      await this.factory.deployQuickWallet(
        _firstTxTo, _firstTxData, _tokenFee, relayer, _feeValue, beforeTime,
        _walletOwner, feePaymentDataSigned, { from: relayer } );
      return QuickWallet.at(walletAddress);
    };

  });

  it('should deploy a QuickWallet contract with correct owner and pay fee in tokens', async function () {
    const walletAddress = await this.computeWalletAddress(walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const wallet = await this.deployQuickWallet(
      this.token.address, sendTokensData, this.token.address, 1, walletOwner
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(1));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(10));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(39));
    (await wallet.owner()).should.be.equal(walletOwner);
  });

  it('should deploy a QuickWallet contract with correct owner and pay fee in eth', async function () {
    const walletAddress = await this.computeWalletAddress(walletOwner);
    await web3.eth.sendTransaction({ from: tokenOwner, to: walletAddress, value: 100 });
    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);

    const balanceTrackerOtherAccount = await balance.tracker(otherAccount);
    const balanceTrackerWallet = await balance.tracker(walletAddress);
    await this.deployQuickWallet(walletAddress, sendTokensData, walletAddress, 1, walletOwner);

    (await balanceTrackerOtherAccount.delta()).should.be.bignumber.equal(new BN(10));
    (await balanceTrackerWallet.get()).should.be.bignumber.equal(new BN(89));
  });

  it('should transfer tokens and pay fee in tokens', async function () {
    const walletAddress = await this.computeWalletAddress(walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const wallet = await this.deployQuickWallet(
      this.token.address, sendTokensData, this.token.address, 1, walletOwner
    );

    const sendMoreTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTime = (await time.latest()) + 60;
    const sendMoreTokensDataSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(
        walletAddress, this.token.address, sendMoreTokensData, this.token.address, 1, 1, beforeTime
      )
    );
    await wallet.call(
      this.token.address, sendTokensData, this.token.address, relayer, 1,
      beforeTime, sendMoreTokensDataSig, { from: relayer }
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(2));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(20));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(28));
  });

  it('should protect a token transfer against replay', async function () {
    const walletAddress = await this.computeWalletAddress(walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const wallet = await this.deployQuickWallet(
      this.token.address, sendTokensData, this.token.address, 1, walletOwner
    );

    const sendMoreTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTime = (await time.latest()) + 10;
    const sendMoreTokensDataSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(
        walletAddress, this.token.address, sendMoreTokensData, this.token.address, 1, 1, beforeTime
      )
    );
    await wallet.call(
      this.token.address, sendMoreTokensData, this.token.address, relayer, 1,
      beforeTime, sendMoreTokensDataSig, { from: relayer }
    );

    await shouldFail.reverting(
      wallet.call(
        this.token.address, sendMoreTokensData, this.token.address, relayer, 1,
        beforeTime, sendMoreTokensDataSig, { from: relayer }
      )
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(2));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(20));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(28));
  });

  it('should protect a token transfer against tx replay with different fees in and time', async function () {
    const walletAddress = await this.computeWalletAddress(walletOwner);
    await this.token.transfer(walletAddress, 50, { from: tokenOwner });
    const sendTokensData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const wallet = await this.deployQuickWallet(
      this.token.address, sendTokensData, this.token.address, 1, walletOwner
    );

    const sendTokensDataHighfee = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const beforeTimeInHighFee = (await time.latest()) + 10;
    const sendTokensDataHighFeeSig = await signMessage(walletOwner,
      web3.utils.soliditySha3(
        walletAddress, this.token.address, sendTokensDataHighfee,
        this.token.address, 3, 1, beforeTimeInHighFee
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
        walletAddress, this.token.address, sendTokensDataLowFee,
        this.token.address, 1, 1, beforeTimeInLowFee
      )
    );
    await wallet.call(
      this.token.address, sendTokensDataHighfee, this.token.address, relayer, 3,
      beforeTimeInHighFee, sendTokensDataHighFeeSig, { from: relayer }
    );

    await shouldFail.reverting(
      wallet.call(
        this.token.address, sendTokensDataLowFee, this.token.address, relayer, 1,
        beforeTimeInLowFee, sendTokensDataLowFeeSig, { from: relayer }
      )
    );

    (await this.token.balanceOf(tokenOwner)).should.be.bignumber.equal(new BN(50));
    (await this.token.balanceOf(relayer)).should.be.bignumber.equal(new BN(4));
    (await this.token.balanceOf(otherAccount)).should.be.bignumber.equal(new BN(20));
    (await this.token.balanceOf(wallet.address)).should.be.bignumber.equal(new BN(26));
  });
});
