import { assert } from 'chai';
import { web3, getAccounts, deployQuickWalletFactory, deployERC20Mock } from './helpers';
import QuickWallet from '../src/index.js';

describe('QuickWallet.index', () => {
  let factory, accounts, token, mnemonic, tokenOwner, otherAccount;

  beforeEach(async () => {
    factory = await deployQuickWalletFactory();
    accounts = await getAccounts();
    tokenOwner = accounts[0];
    otherAccount = accounts[3];
    token = await deployERC20Mock(tokenOwner, 100);
    mnemonic = QuickWallet.generateMnemonic();
  });

  it('should send transaction using QuickWallet and pay fee in ETH', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(1);

    const quickWallets = quickWallet.getQuickWallets();
    const newWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    await web3.eth.sendTransaction({ from: tokenOwner, to: newWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: newWallet.owner, value: web3.utils.toWei('1000') });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    await quickWallet.sendTransaction({
      from: newWallet.address,
      to: newWallet.address,
      data: txData,
      value: 0,
      feeToken: newWallet.address,
      feeTo: newWallet.owner,
      gasPrice: 1,
      feeValue: 0,
      timeLimit: 60,
    });

    assert(await web3.eth.getBalance(newWallet.address), '90');
    assert(await newWallet.contract.methods.txCount(), 1);
    assert(await newWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(newWallet.owner));
  });

  it('relay transaction using QuickWallet and pay fee in ETH', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(2);

    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    const relayerWallet = await quickWallet.getQuickWallet(quickWallets[1].address);
    await web3.eth.sendTransaction({ from: tokenOwner, to: senderWallet.address, value: 100 });
    await web3.eth.sendTransaction({ from: otherAccount, to: relayerWallet.owner, value: web3.utils.toWei('1000') });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const quickTransactionSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.address,
      to: senderWallet.address,
      data: txData,
      value: 0,
      feeToken: senderWallet.address,
      feeValue: 0,
      timeLimit: 60,
    });

    await quickWallet.relayTransaction({
      from: relayerWallet.owner,
      quickTransaction: quickTransactionSigned,
      gasPrice: 1,
    });

    assert(await web3.eth.getBalance(senderWallet.address), '90');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.owner));
  });

  it('should send transaction using QuickWallet and pay fee in ERC20', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(1);

    const quickWallets = quickWallet.getQuickWallets();
    const newWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    await token.methods.transfer(newWallet.address, 100).send({ from: tokenOwner });
    await web3.eth.sendTransaction({ from: otherAccount, to: newWallet.owner, value: web3.utils.toWei('1000') });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    await quickWallet.sendTransaction({
      from: newWallet.address,
      to: token.address,
      data: txData,
      value: 0,
      feeToken: token.address,
      feeTo: newWallet.owner,
      gasPrice: 1,
      feeValue: 1,
      timeLimit: 60,
    });

    assert(await token.methods.balanceOf(newWallet.address).call(), '90');
    assert(await token.methods.balanceOf(otherAccount).call(), '10');
    assert(await newWallet.contract.methods.txCount(), 1);
    assert(await newWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(newWallet.owner));
  });

  it('relay transaction using QuickWallet and pay fee in ERC20', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
    quickWallet.generateAddresses(2);

    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    const relayerWallet = await quickWallet.getQuickWallet(quickWallets[1].address);
    await token.methods.transfer(senderWallet.address, 100).send({ from: tokenOwner });
    await web3.eth.sendTransaction({ from: otherAccount, to: relayerWallet.owner, value: web3.utils.toWei('1000') });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 50]);
    const quickTransactionSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.address,
      to: token.address,
      data: txData,
      value: 0,
      feeToken: token.address,
      feeValue: 5,
      timeLimit: 60,
    });

    await quickWallet.relayTransaction({
      from: relayerWallet.owner,
      quickTransaction: quickTransactionSigned,
      gasPrice: 1,
    });

    assert(await token.methods.balanceOf(senderWallet.address).call(), '45');
    assert(await token.methods.balanceOf(otherAccount).call(), '50');
    assert(await token.methods.balanceOf(relayerWallet.owner).call(), '5');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.owner));
  });
});
