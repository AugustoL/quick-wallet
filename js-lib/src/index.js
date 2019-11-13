import 'babel-polyfill';
import { fromExtendedKey } from 'ethereumjs-wallet/hdkey';
import EthSigUtil from 'eth-sig-util';
import Mnemonic from 'bitcore-mnemonic';
import Web3 from 'web3';
import {
  bytecode as walletBytecode, abi as walletABI,
} from '../../smart-contracts/build/contracts/QuickWallet.json';
import {
  abi as walletFactoryABI,
} from '../../smart-contracts/build/contracts/QuickWalletFactory.json';

// See https://github.com/ethereum/EIPs/issues/85
const BIP44_PATH = 'm/44\'/60\'/0\'/0';

/**
 * Add the 0x prefix to a string if not preset
 * @param  String text
 * @return String
 */
const addHexPrefix = (text) => {
  return (!text.slice(0, 2) !== '0x') ? '0x' + text : text;
};

/**
 * Represents a QuickWallet instance.
 */
export default class QuickWallet {
  /**
   * Construct HD wallet instance from given mnemonic
   *
   * @param String mnemonic Mnemonic/seed string.
   * @param String QuickWallet factory address
   *
   * @return {QuickWallet}
   */
  static fromMnemonic (mnemonic, walletFactoryAddress) {
    const { xprivkey } = new Mnemonic(mnemonic).toHDPrivateKey();
    return new QuickWallet(xprivkey, walletFactoryAddress);
  }

  /**
   * Generate a 12-word mnemonic in English.
   * @return {[String]}
   */
  static generateMnemonic () {
    return new Mnemonic(Mnemonic.Words.ENGLISH).toString();
  };

  /**
   * @constructor
   *
   * @param String The HD master private key
   * @param String QuickWallet factory address
   * @param String Web3 provider url (Optional)
   */
  constructor (xPrivKey, walletFactoryAddress, web3Provider = 'http://localhost:8545') {
    this._web3 = new Web3(
      web3Provider, undefined, { transactionConfirmationBlocks: 1, defaultHardfork: 'constantinople' }
    );
    this._walletFactory = new this._web3.eth.Contract(walletFactoryABI, walletFactoryAddress);
    if (!this._walletFactory.address) {
      this._walletFactory.address = this._walletFactory._address;
    }
    this._hdKey = fromExtendedKey(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this.wallets = [];
  }

  /**
   * Generate new addresses.
   *
   * @param Number num No. of new addresses to generate.
   *
   * @return [String]
   */
  generateAddresses (num) {
    const newKeys = this._deriveNewKeys(num);
    return newKeys.map(k => k.secondaryAddress);
  }

  /**
  * Remove a generated addresses.
  *
  * @param The address to be removed from the list of addresses.
  *
  * @return [String] The address to remove
  */
  removeAddress (secondaryAddress) {
    this.wallets.splice(this.wallets.findIndex(w => w.secondaryAddress), 1);
  }

  /**
   * Get all quickwallets addresses and owners.
   * @return [Object]
   */
  getQuickWallets () {
    return this.wallets;
  }

  /**
   * Get the quickwallet info.
   *
   * @return Object
   *  @param  String primaryAddress The primary address used for signing
   *  @param  String secondaryAddress The secondary address that will be sending this tx
   *  @param  Boolean deployed If the QuickWallet contract is deployed or not
   *  @param  String contract The QuickWallet contract
   */
   */
  async getQuickWalletInfo (secondaryAddr) {
    const quickWallet = this.wallets.find(({ secondaryAddress }) => secondaryAddress === secondaryAddr);
    if (!quickWallet) { throw new Error('Invalid quick quickWallet address'); }
    quickWallet.deployed = (await this._web3.eth.getCode(quickWallet.secondaryAddress) !== '0x');
    quickWallet.contract = new this._web3.eth.Contract(walletABI, quickWallet.secondaryAddress);
    return quickWallet;
  }

  /**
   * Send transaction from primary address
   * @return Object The signed transaction sent
   */
  async sendTransaction ({
    from, to, data, value, feeToken, feePayeer, feeValue, timeLimit, chainId, gasPrice,
  }) {
    const quickTransactionSigned = await this.signQuickTransaction({
      from, to, data, value, feeToken, feeValue, timeLimit: 60,
    });
    return this.relayTransaction({
      gasPrice, from: feePayeer, quickTransaction: quickTransactionSigned,
    });
  }

  /**
   * Relay a signed quickTransaction from owner address
   * @return Object The signed transaction sent
   */
  async relayTransaction ({
    from, quickTransaction, chainId, gasPrice, gasLimit,
  }) {
    const walletContract = new this._web3.eth.Contract(walletABI, quickTransaction.from);
    let to, data;
    if ((await this._web3.eth.getCode(quickTransaction.from)) === '0x') {
      data = this._walletFactory.methods.deployQuickWallet(
        quickTransaction.primaryAddress,
        quickTransaction.txData,
        quickTransaction.txSignature,
        from
      ).encodeABI();
      to = this._walletFactory.address;
    } else {
      data = walletContract.methods.call(
        quickTransaction.txData,
        quickTransaction.txSignature,
        from
      ).encodeABI();
      to = quickTransaction.from;
    }
    const txSigned = await this.signETHTransaction({
      from: from, to: to, data: data, gasPrice: gasPrice, gasLimit: gasLimit,
    });
    return this._web3.eth.sendSignedTransaction(txSigned.rawTransaction);
  }

  /**
   * Relay a signed quickTransaction from owner address
   * @return Number
   */
  async estimateRelayCost ({ from, quickTransaction }) {
    const walletContract = new this._web3.eth.Contract(walletABI, quickTransaction.from);
    let to, data;
    if ((await this._web3.eth.getCode(quickTransaction.from)) === '0x') {
      data = this._walletFactory.methods.deployQuickWallet(
        quickTransaction.primaryAddress,
        quickTransaction.txData,
        quickTransaction.txSignature,
        from
      ).encodeABI();
      to = this._walletFactory.address;
    } else {
      data = walletContract.methods.call(
        quickTransaction.txData,
        quickTransaction.txSignature,
        from
      ).encodeABI();
      to = quickTransaction.from;
    }
    return this._web3.eth.estimateGas({ from: from, to: to, data: data });
  }

  /**
   * Sign ETH transaction data.
   *
   * @param  String from The primary address wallet to be used
   * @param  String [to] If omitted then deploying a contract
   * @param  Number value Amount of wei to send
   * @param  String data Data
   * @param  Number gasLimit Total Gas to use
   * @param  Number gasPrice Gas price (wei per gas unit)
   * @param  String chainId Chain id
   *
   * @return String Raw transaction string.
   */
  async signETHTransaction ({ nonce, from, to, value, data, gasLimit, gasPrice, chainId }) {
    const wallet = this.wallets.find(({ primaryAddress }) => from === primaryAddress) || {};
    if (!wallet) { throw new Error('Invalid from address'); };
    if (!nonce) { nonce = await this._web3.eth.getTransactionCount(from); };
    if (!gasPrice) { gasPrice = await this._web3.eth.getGasPrice(); };
    if (!gasLimit) { gasLimit = 6000000; };
    return this._web3.eth.accounts.signTransaction({
      nonce, to, value, data, gas: gasLimit, gasPrice, chainId,
    }, addHexPrefix(wallet.getPrivateKey().toString('hex')));
  }

  /**
   * Sign quick transaction from owner address
   *
   * @param  String from The secondary address wallet to be used
   * @param  String to The address of the receiver
   * @param  String data Transaction data for smart contracts functions
   * @param  Number value Amount of wei to send
   * @param  Number feeToken In which token the gas is payed, use form address for ETH
   * @param  Number feeValue The amount to wei to be payed as fee
   * @param  Number timeLimit In how much time the tx need to be executed
   * @param  Number txCount Transaction count to be used
   *
   * @return Object
   *  @param  String primaryAddress The primary address used for signing
   *  @param  String from The secondary address that will be sending this tx
   *  @param  String txData The tx data to be pushed to the network
   *  @param  String txSignature The signature of the tx data
   */
  async signQuickTransaction ({ from, to, data, value, feeToken, feeValue, timeLimit, txCount }) {
    const wallet = await this.getQuickWalletInfo(from);
    const walletContract = new this._web3.eth.Contract(walletABI, from);
    if (!txCount) { txCount = wallet.deployed ? await walletContract.methods.txCount().call() : 0; }
    const beforeTime = (await this._web3.eth.getBlock('latest')).timestamp + timeLimit;
    const txData = this._web3.eth.abi.encodeParameters(
      ['address', 'bytes', 'uint256', 'address', 'uint256', 'uint256'],
      [to, data, value, feeToken, feeValue, beforeTime]
    );
    const txSignature = await this.sign(wallet.primaryAddress,
      this._web3.utils.soliditySha3(
        wallet.secondaryAddress, txData, txCount
      )
    );
    return {
      primaryAddress: wallet.primaryAddress,
      from: wallet.secondaryAddress,
      txData: txData,
      txSignature: txSignature,
    };
  }

  /**
   * Sign data.
   *
   * @param String address Address whos private key to sign with
   * @param String|Buffer|BN data Data
   *
   * @return String Signed data
   */
  sign (primaryAddr, data) {
    const wallet = this.wallets.find(({ primaryAddress }) => primaryAddress === primaryAddr);
    if (!wallet) { throw new Error('Invalid address'); };
    return (EthSigUtil.personalSign(wallet.getPrivateKey(), { data }));
  }

  /**
   * Recover public key of signing account.
   *
   * @param String signature The signed message
   * @param String|Buffer|BN data The original input data
   *
   * @return String Address of the signer
   */
  recover (message, signature) {
    return EthSigUtil.recoverPersonalSignature({ data: message, sig: signature });
  }

  /**
  * Deterministically computes the smart contract address
  *
  * @param String deployerAddress The address of the creator contract
  * @param String saltHex The salt to be used in hex format
  * @param String byteCode The bytecode of the smart contract to create
  */
  buildCreate2Address (deployerAddress, saltHex, byteCode) {
    return this._web3.utils.toChecksumAddress(`0x${this._web3.utils.sha3(`0x${[
      'ff',
      deployerAddress,
      saltHex,
      this._web3.utils.soliditySha3(byteCode),
    ].map(x => x.replace(/0x/, '')).join('')}`).slice(-40)}`);
  };

  /**
   * Derive new key pairs.
   *
   * This will increment the internal key index counter and add the
   * generated keypairs to the internal list.
   *
   * @param Number num no. of new keypairs to generate
   *
   * @return [String] Generated keypairs.
   */
  _deriveNewKeys (num) {
    for (let i = num; i > 0; i--) {
      const wallet = this._root.deriveChild(this.wallets.length).getWallet();
      const primaryAddress = addHexPrefix(wallet.getAddress().toString('hex'));
      wallet.primaryAddress = primaryAddress;
      wallet.secondaryAddress = this.buildCreate2Address(
        this._walletFactory.address,
        this._web3.utils.soliditySha3(primaryAddress),
        walletBytecode + this._web3.eth.abi.encodeParameters(['address'], [primaryAddress]).substring(2)
      );
      this.wallets.push(wallet);
    };
    return this.wallets.slice(-num);
  }
}
