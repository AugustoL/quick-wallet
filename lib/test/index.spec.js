import { assert } from 'chai';
import { web3, getAccounts, deployQuickWalletFactory, deployERC20Mock } from './helpers';
import QuickWallet from '../src/index.js';

describe('QuickWallet.index', () => {
  let factory, accounts, token, mnemonic, tokenOwner, walletOwner, relayer, otherAccount;

  beforeEach(async () => {
    factory = await deployQuickWalletFactory();
    accounts = await getAccounts();
    tokenOwner = accounts[0];
    walletOwner = accounts[1];
    relayer = accounts[2];
    otherAccount = accounts[3];
    token = await deployERC20Mock(tokenOwner, 100);
    mnemonic = QuickWallet.generateMnemonic();
  });

  it('should send transaction using QuickWallet', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(1);

    const quickWallets = quickWallet.getQuickWallets();
    const newWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    await web3.eth.sendTransaction({ from: tokenOwner, to: newWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: newWallet.owner, value: web3.utils.toWei('1000') });

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
      timeLimit: 60
    });

    assert(await web3.eth.getBalance(newWallet.address), '90');
    assert(await newWallet.contract.methods.txCount(), 1);
    assert(await newWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(newWallet.owner));
  });


  it('relay transaction using QuickWallet', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(2);

    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    const relayerWallet = await quickWallet.getQuickWallet(quickWallets[1].address);
    await web3.eth.sendTransaction({ from: tokenOwner, to: senderWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: relayerWallet.owner, value: web3.utils.toWei('1000') });

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
      gasPrice: 1
    });

    assert(await web3.eth.getBalance(senderWallet.address), '90');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.owner));
  });
});
