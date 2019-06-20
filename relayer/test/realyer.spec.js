import { assert } from 'chai';
import QuickWallet from '../../js-lib/dist/index.js';
import Token from '../../smart-contracts/build/contracts/ERC20Mock.json';
import Web3 from 'web3';

const fetch = require('node-fetch');

const fs = require('fs');
const web3 = new Web3('http://localhost:8545', undefined, { transactionConfirmationBlocks: 1 });
const config = require('../.config-dev.json');

describe('relayer.index', () => {
  let factory, accounts, token, tokenOwner, otherAccount, mnemonic;

  beforeEach(async () => {
    accounts = await web3.eth.getAccounts();
    token = new web3.eth.Contract(Token.abi, config.token);
    tokenOwner = accounts[0];
    otherAccount = web3.eth.accounts.wallet.create(1)[0].address;
    mnemonic = await QuickWallet.generateMnemonic();
  });

  it('relay transaction using QuickWallet and pay fee in ETH', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, config.quickWalletFactory);
    quickWallet.generateAddresses(1);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWallet(quickWallets[0].address);

    await web3.eth.sendTransaction({ from: tokenOwner, to: senderWallet.address, value: web3.utils.toWei('1') });

    const firstTxData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, web3.utils.toWei("0.999")]);
    const firstTxSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.address,
      to: senderWallet.address,
      data: firstTxData,
      value: 0,
      feeToken: senderWallet.address,
      feeValue: web3.utils.toWei("0.001"),
      timeLimit: 60,
    });

    const postQuickTx = await fetch('http://localhost:3000/', {
      method: 'POST',
      body: JSON.stringify(firstTxSigned),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await postQuickTx.json();

    assert(response.tx.transactionHash);
    assert(await web3.eth.getBalance(senderWallet.address), 0);
    assert(await web3.eth.getBalance(otherAccount), web3.utils.toWei("1"));
    assert(await senderWallet.contract.methods.txCount().call(), 1);
    assert(await senderWallet.contract.methods.owner().call(), web3.utils.toChecksumAddress(senderWallet.owner));
  });

  // Skip till https://github.com/trufflesuite/ganache-core/pull/419 is merged
  it.skip('relay transaction using QuickWallet and pay fee in ERC20', async function () {
    const quickWallet = QuickWallet.fromMnemonic(mnemonic, config.quickWalletFactory);
    quickWallet.generateAddresses(1);
    const quickWallets = quickWallet.getQuickWallets();
    const senderWallet = await quickWallet.getQuickWallet(quickWallets[0].address);
    await token.methods.transfer(senderWallet.address, web3.utils.toWei("1")).send({ from: tokenOwner, chianId: 1337 });

    const firstTxData = web3.eth.abi.encodeFunctionCall({
      name: 'transfer',
      type: 'frunction',
      inputs: [{ type: 'address', name: 'to' }, { type: 'uint256', name: 'value' }],
    }, [otherAccount, web3.utils.toWei("0.999")]);
    const firstTxSigned = await quickWallet.signQuickTransaction({
      from: senderWallet.address,
      to: token.address,
      data: firstTxData,
      value: 0,
      feeToken: token.address,
      feeValue: web3.utils.toWei("0.001"),
      timeLimit: 60,
    });

    const postQuickTx = await fetch('http://localhost:3000/', {
      method: 'POST',
      body: JSON.stringify(firstTxSigned),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await postQuickTx.json();

    assert(response.tx.transactionHash);
    assert(await token.methods.balanceOf(senderWallet.address).call(), web3.utils.toWei("0"));
    assert(await token.methods.balanceOf(otherAccount).call(), web3.utils.toWei("0.999"));
    assert(await senderWallet.contract.methods.txCount().call(), 1);
    assert(await senderWallet.contract.methods.owner().call(), web3.utils.toChecksumAddress(senderWallet.owner));
  });
});
