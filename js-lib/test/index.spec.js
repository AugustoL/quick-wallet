import { assert } from 'chai';
import { web3, deployQuickWalletFactory, deployERC20Mock } from './helpers';
import QuickWallet from '../src/index.js';

describe('QuickWallet.index', () => {
  let factory, accounts, token, mnemonic, tokenOwner, otherAccount, quickWallet;

  beforeEach(async () => {
    factory = await deployQuickWalletFactory();
    factory.address = factory._address;
    accounts = await web3.eth.getAccounts();
    tokenOwner = accounts[0];
    otherAccount = accounts[1];
    token = await deployERC20Mock(tokenOwner, 100);
    token.address = token._address;
    mnemonic = QuickWallet.generateMnemonic();
    quickWallet = QuickWallet.fromMnemonic(mnemonic, factory.address);
  });

  it('should add/remove wallets', async function () {
    quickWallet.generateAddresses(4);
    const quickWallets = quickWallet.getQuickWallets();
    assert(quickWallets.length, 4);
    quickWallet.removeAddress(quickWallets[2].secondaryAddress);
    assert(quickWallets.length, 3);
  });

  it('should sign/recover message', async function () {
    quickWallet.generateAddresses(1);
    const message = web3.utils.sha3('message');
    const quickWallets = quickWallet.getQuickWallets();
    const signature = quickWallet.sign(quickWallets[0].primaryAddress, message);
    assert(quickWallets[0].primaryAddress, quickWallet.recover(message, signature));
  });

  it('should get the wallet info', async function () {
    quickWallet.generateAddresses(1);
    const quickWallets = quickWallet.getQuickWallets();
    const newWallet = await quickWallet.getQuickWalletInfo(quickWallets[0].secondaryAddress);
    assert(quickWallets.length, 1);
    assert(quickWallets[0].secondaryAddress);
    assert(quickWallets[0].primaryAddress);
    assert(newWallet.secondaryAddress, quickWallets[0].secondaryAddress);
  });

  it('should send transaction using QuickWallet and pay fee in ETH', async function () {
    quickWallet.generateAddresses(1);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWalletInfo(quickWallets[0].secondaryAddress);
    await web3.eth.sendTransaction({
      from: tokenOwner, to: senderWallet.secondaryAddress, value: 100,
    });
    await web3.eth.sendTransaction({
      from: otherAccount, to: senderWallet.primaryAddress, value: web3.utils.toWei('1000'),
    });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    await quickWallet.sendTransaction({
      from: senderWallet.secondaryAddress,
      to: senderWallet.secondaryAddress,
      data: txData,
      value: 0,
      feeToken: token.address,
      feePayeer: senderWallet.primaryAddress,
      gasPrice: 1,
      feeValue: 0,
      timeLimit: 60,
    });

    assert(await web3.eth.getBalance(senderWallet.secondaryAddress), '90');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.primaryAddress));
  });

  it('relay transaction using QuickWallet and pay fee in ETH', async function () {
    quickWallet.generateAddresses(2);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWalletInfo(quickWallets[0].secondaryAddress);
    const relayerWallet = await quickWallet.getQuickWalletInfo(quickWallets[1].secondaryAddress);
    await web3.eth.sendTransaction({ from: tokenOwner, to: senderWallet.secondaryAddress, value: 100 });
    await web3.eth.sendTransaction({
      from: otherAccount, to: relayerWallet.primaryAddress, value: web3.utils.toWei('1000'),
    });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    const quickTransactionSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.secondaryAddress,
      to: senderWallet.secondaryAddress,
      data: txData,
      value: 0,
      feeToken: token.address,
      feeValue: 0,
      timeLimit: 60,
    });
    await quickWallet.relayTransaction({
      from: relayerWallet.primaryAddress,
      quickTransaction: quickTransactionSigned,
      gasPrice: 1,
    });

    assert(await web3.eth.getBalance(senderWallet.secondaryAddress), '90');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(),
      web3.utils.toChecksumAddress(senderWallet.primaryAddress)
    );
  });

  it('should send transaction using QuickWallet and pay fee in ERC20', async function () {
    quickWallet.generateAddresses(1);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWalletInfo(quickWallets[0].secondaryAddress);
    await token.methods.transfer(senderWallet.secondaryAddress, 100).send({ from: tokenOwner });
    await web3.eth.sendTransaction({
      from: otherAccount, to: senderWallet.primaryAddress, value: web3.utils.toWei('1000'),
    });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 10]);
    await quickWallet.sendTransaction({
      from: senderWallet.secondaryAddress,
      to: token.address,
      data: txData,
      value: 0,
      feeToken: token.address,
      feePayeer: senderWallet.primaryAddress,
      gasPrice: 1,
      feeValue: 1,
      timeLimit: 60,
    });

    assert(await token.methods.balanceOf(senderWallet.secondaryAddress).call(), '90');
    assert(await token.methods.balanceOf(otherAccount).call(), '10');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.primaryAddress));
  });

  it('relay transaction using QuickWallet and pay fee in ERC20', async function () {
    quickWallet.generateAddresses(2);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWalletInfo(quickWallets[0].secondaryAddress);
    const relayerWallet = await quickWallet.getQuickWalletInfo(quickWallets[1].secondaryAddress);
    await token.methods.transfer(senderWallet.secondaryAddress, 100).send({ from: tokenOwner });
    await web3.eth.sendTransaction({
      from: otherAccount, to: relayerWallet.primaryAddress, value: web3.utils.toWei('1000'),
    });

    const txData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, 50]);
    const quickTransactionSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.secondaryAddress,
      to: token.address,
      data: txData,
      value: 0,
      feeToken: token.address,
      feeValue: 5,
      timeLimit: 60,
    });
    await quickWallet.relayTransaction({
      from: relayerWallet.primaryAddress,
      quickTransaction: quickTransactionSigned,
      gasPrice: 1,
    });

    assert(await token.methods.balanceOf(senderWallet.secondaryAddress).call(), '45');
    assert(await token.methods.balanceOf(otherAccount).call(), '50');
    assert(await token.methods.balanceOf(relayerWallet.primaryAddress).call(), '5');
    assert(await senderWallet.contract.methods.txCount(), 1);
    assert(await senderWallet.contract.methods.owner.call(), web3.utils.toChecksumAddress(senderWallet.primaryAddress));
  });
});
