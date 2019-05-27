const { BN, shouldFail, time } = require('openzeppelin-test-helpers');
const { generateMnemonic, QuickWallet } = require('../../dist');

const { buildCreate2Address } = require('../helpers/create2');
const { toEthSignedMessageHash } = require('../helpers/sign');

const Create2 = artifacts.require('Create2');
const WalletFactory = artifacts.require('WalletFactory');
const Wallet = artifacts.require('Wallet');
const ERC20Mock = artifacts.require('ERC20Mock');

contract('QuickWallet Lib', function ([_, tokenOwner, walletOwner, relayer, otherAccount]) {
  const walletBytecode = Wallet.bytecode;
  let saltHex;

  beforeEach(async function () {
    const create2Lib = await Create2.new();
    await WalletFactory.link('Create2', create2Lib.address);
    this.factory = await WalletFactory.new(walletBytecode);
    this.token = await ERC20Mock.new(tokenOwner, 100);
    saltHex = web3.utils.randomHex(32);
  });

  it('should create a wallet using BIP44', async function () {
    const quickWallet = QuickWallet.fromMnemonic(generateMnemonic(), this.factory.address);
    quickWallet.generateAddresses(1);
    const newWallet = quickWallet.getWallets()[0];

    await web3.eth.sendTransaction({ from: tokenOwner, to: newWallet.address, value: 100 });

    const constructorData = web3.eth.abi.encodeParameters(['address'], [newWallet.owner]);
    const feePaymentData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [relayer, 20]);
    const beforeTime = (await time.latest()) + 60;
    const feePaymentDataSigned = await quickWallet.sign(newWallet.owner,
      web3.utils.soliditySha3(newWallet.address, newWallet.address, feePaymentData, 0, beforeTime)
    );
    await this.factory.deploy(
      newWallet.salt, newWallet.address, 20, beforeTime, newWallet.owner, feePaymentDataSigned, { from: relayer }
    );
    return Wallet.at(newWallet.address);

    (await web3.eth.getBalance(wallet.address)).should.be.equal('20');
    (await wallet.owner()).should.be.equal(newWallet.owner);
  });
});
