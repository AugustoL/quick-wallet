import 'babel-polyfill';
import { fromExtendedKey } from 'ethereumjs-wallet/hdkey';
import EthSigUtil from 'eth-sig-util';
import EthereumTx from 'ethereumjs-tx';
import Mnemonic from 'bitcore-mnemonic';
import Web3 from 'web3';
import {
  bytecode as walletBytecode, abi as walletABI,
} from '../../smart-contracts/build/contracts/QuickWallet.json';
import {
  abi as walletFactoryABI
} from '../../smart-contracts/build/contracts/QuickWalletFactory.json';

// See https://github.com/ethereum/EIPs/issues/85
const BIP44_PATH = 'm/44\'/60\'/0\'/0';

/**
 * Add the 0x prefix to a string if not preset
 * @param  String text
 * @return String
 */const addHexPrefix = (text) => {
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
    this._web3 = new Web3(web3Provider, undefined, { transactionConfirmationBlocks: 1 });
    this._walletFactory = new this._web3.eth.Contract(walletFactoryABI, walletFactoryAddress);
    if (!this._walletFactory.address)
      this._walletFactory.address = this._walletFactory._address;
    this._hdKey = fromExtendedKey(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this._children = [];
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
    return newKeys.map(k => k.address);
  }

  /**
  * Discard generated addresses.
  *
  * @param Number num The number of addresses to remove from the end of the list of addresses.
  *
  * @return [String] The discarded addresses
  */
  discardAddresses (num) {
    const discard = this._children.splice(-num);
    return discard.map(k => k.address);
  }

  /**
  * Get all addresses.
  * @return [String]
  */
  getAddresses () {
    return this._children.map(k => k.address);
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
   * Get all quickwallets addresses and owners.
   * @return [Object]
   */
  getQuickWallets () {
    return this._children.map(k => {
      return {
        address: k.address,
        owner: k.owner,
      };
    });
  }

  /**
   * Get the quickwallet info.
   *
   * @return Object
   */
  async getQuickWalletInfo (addr) {
    const wallet = this._children.find(({ address }) => addr === address);
    if (!wallet) { throw new Error('Invalid quick wallet address'); }

    wallet.deployed = (await this._web3.eth.getCode(wallet.address) !== '0x');
    wallet.balance = await this._web3.eth.getBalance(wallet.address);
    wallet.contract = new this._web3.eth.Contract(walletABI, wallet.address);

    return wallet;
  }

  /**
   * Get no. of addresses.
   *
   * @return Number
   */
  getAddressCount () {
    return this._children.map(k => k.address).length;
  }

  /**
   * Send transaction from owner address
   * @return Object
   */
  async sendTransaction ({ from, to, data, value, feeToken, feeTo, feeValue, timeLimit, chainId, gasPrice }) {
    const wallet = await this.getQuickWalletInfo(from);
    const walletContract = new this._web3.eth.Contract(walletABI, from);
    const txCount = wallet.deployed ? await walletContract.methods.txCount().call() : 0;
    const beforeTime = (await this._web3.eth.getBlock('latest')).timestamp + timeLimit;
    const txData = this._web3.eth.abi.encodeParameters(
      ['address', 'bytes', 'uint256', 'address', 'uint256', 'uint256'],
      [to, data, value, feeToken, feeValue, beforeTime]
    );
    const txSig = await this.sign(wallet.owner, this._web3.utils.soliditySha3(wallet.address, txData, txCount));
    let _to, _data;

    if (!wallet.deployed) {
      _data = this._walletFactory.methods.deployQuickWallet(
        wallet.owner, txData, txSig, wallet.owner
      ).encodeABI();
      _to = this._walletFactory.address;
    } else {
      _data = walletContract.methods.call(txData, txSig, wallet.owner).encodeABI();
      _to = wallet.address;
    }
    const txSigned = await this.signETHTransaction(
      { from: wallet.owner, to: _to, data: _data, chainId: chainId, gasPrice: gasPrice }
    );
    return this._web3.eth.sendSignedTransaction(txSigned);
  }

  /**
   * Relay a signed quickTransaction from owner address
   * @return Object
   */
  async relayTransaction ({
    from, quickTransaction, chainId, gasPrice, gasLimit,
  }) {
    const walletContract = new this._web3.eth.Contract(walletABI, quickTransaction.from);
    let to, data;
    if ((await this._web3.eth.getCode(quickTransaction.from)) === '0x') {
      data = this._walletFactory.methods.deployQuickWallet(
        quickTransaction.owner,
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
    return this._web3.eth.sendSignedTransaction(txSigned);
  }

  /**
   * Relay a signed quickTransaction from owner address
   * @return Object
   */
  async estimateRelayCost ({ from, quickTransaction }) {
    const walletContract = new this._web3.eth.Contract(walletABI, quickTransaction.from);
    let to, data;
    if ((await this._web3.eth.getCode(quickTransaction.from)) === '0x') {
      data = this._walletFactory.methods.deployQuickWallet(
        quickTransaction.owner,
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
    return this._web3.eth.estimateGas({from: from, to: to, data: data});
  }

  /**
   * Sign ETH transaction data.
   *
   * @param  String from From address
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
    const { wallet } = this._children.find(({ owner }) => from === owner) || {};

    if (!wallet) {
      throw new Error('Invalid from address');
    }

    if (!nonce) { nonce = await this._web3.eth.getTransactionCount(from); }

    if (!gasPrice) { gasPrice = await this._web3.eth.getGasPrice(); }

    if (!gasLimit) { gasLimit = await this._web3.eth.estimateGas({ to: to, data: data }); }

    const tx = new EthereumTx({
      nonce, to, value, data, gasLimit, gasPrice, chainId,
    });

    tx.sign(wallet.getPrivateKey());
    return addHexPrefix(tx.serialize().toString('hex'));
  }

  /**
   * Sign quick transaction from owner address
   * @return Object
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
    const txSignature = await this.sign(wallet.owner,
      this._web3.utils.soliditySha3(
        wallet.address, txData, txCount
      )
    );
    return {
      owner: wallet.owner,
      from: wallet.address,
      txData: txData,
      txSignature: txSignature,
    };
  }

  /**
   * Check whether given address is present in current list of generated addresses.
   *
   * @param String addr The wallet address to check
   *
   * @return Boolean
   */
  hasAddress (addr) {
    return !!this._children.find(({ address }) => addr === address);
  }

  /**
   * Check whether given address is present in current list of generated addresses.
   *
   * @param String addr The owner address to check
   *
   * @return Boolean
   */
  hasOwner (_owner) {
    return !!this._children.find(({ owner }) => _owner === owner);
  }

  /**
   * Sign data.
   *
   * @param String address Address whos private key to sign with
   * @param String|Buffer|BN data Data
   *
   * @return String Signed data
   */
  sign (owner, data) {
    const { wallet } = this._children.find(({ owner: a }) => owner === a) || {};
    if (!wallet) { throw new Error('Invalid address'); }
    return EthSigUtil.personalSign(wallet.getPrivateKey(), { data });
  }

  /**
   * Recover public key of signing account.
   *
   * @param String signature The signed message
   * @param String|Buffer|BN data The original input data
   *
   * @return String Public signing key
   */
  recoverSignerPublicKey (signature, data) {
    return EthSigUtil.recoverPersonalSignature({ sig: signature, data });
  }

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
    for (let i = num; i >= 0; i--) {
      const child = this._root.deriveChild(this._children.length).getWallet();
      const owner = addHexPrefix(child.getAddress().toString('hex'));
      this._children.push({
        wallet: child,
        owner: owner,
        address: this.buildCreate2Address(
          this._walletFactory.address,
          this._web3.utils.soliditySha3(owner),
          walletBytecode + this._web3.eth.abi.encodeParameters(['address'], [owner]).substring(2)
        ),
      });
    };
    return this._children.slice(-num);
  }
}
