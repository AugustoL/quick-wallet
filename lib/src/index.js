import { fromExtendedKey } from 'ethereumjs-wallet/hdkey';
import EthSigUtil from 'eth-sig-util';
import EthereumTx from 'ethereumjs-tx'
import Mnemonic from 'bitcore-mnemonic';
import Web3 from 'web3';
import { bytecode as walletBytecode, abi as walletABI } from '../../build/contracts/Wallet.json';
import { bytecode as walletFactoryBytecode, abi as walletFactoryABI } from '../../build/contracts/WalletFactory.json';

// See https://github.com/ethereum/EIPs/issues/85
const BIP44_PATH = 'm/44\'/60\'/0\'/0';

/**
 * Add the 0x prefix to a string if not preset
 * @param  String text
 * @return String
 */const addHexPrefix = (text) => {
  return (!text.slice(0,2) != '0x') ? '0x' + text : text;
};

/**
 * Generate a 12-word mnemonic in English.
 * @return {[String]}
 */
export const generateMnemonic = () => {
  return new Mnemonic(Mnemonic.Words.ENGLISH).toString();
};

/**
 * Represents a QuickWallet instance.
 */
export class QuickWallet {
  /**
   * Construct HD wallet instance from given mnemonic
   *
   * @param String mnemonic Mnemonic/seed string.
   * @param String Wallet factory address
   *
   * @return {QuickWallet}
   */
  static fromMnemonic (mnemonic, walletFactoryAddress) {
    const { xprivkey } = new Mnemonic(mnemonic).toHDPrivateKey();
    return new QuickWallet(xprivkey, walletFactoryAddress);
  }

  /**
   * @constructor
   *
   * @param String The HD master private key
   * @param String Wallet factory address
   * @param String Web3 provider url (Optional)
   */
  constructor (xPrivKey, walletFactoryAddress, web3Provider = 'http://localhost:8545') {
    this._walletFactory = new web3.eth.Contract(walletFactoryABI, walletFactoryAddress);
    this._hdKey = fromExtendedKey(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this._children = [];
    this._web3 = new Web3(web3Provider);
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
   * Deterministically computes the smart contract address
   *
   * @param String ncreatorAddress The address of the creator contract
   * @param String saltHex The salt to be used in hex format
   * @param String byteCode The bytecode of the smart contract to create
   */
  buildCreate2Address (creatorAddress, saltHex, byteCode) {
    return this._web3.utils.toChecksumAddress(`0x${this._web3.utils.sha3(`0x${[
      'ff',
      creatorAddress,
      saltHex,
      this._web3.utils.soliditySha3(byteCode),
    ].map(x => x.replace(/0x/, '')).join('')}`).slice(-40)}`);
  };

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
   * Get all wallets.
   * @return [Object]
   */
  getWallets () {
    return this._children.map(k => {
      return {
        address: k.address,
        owner: k.owner
      };
    });
  }


  /**
   * Send transaction from owner address
   * @return Object
   */
  async sendTransaction ({from, to, data, feeToken, feeTo, feeValue, timeLimit, chainId, gasPrice}) {
    const wallet = await this.getWallet(from);
    const walletContract = new web3.eth.Contract(walletABI, from);
    const txCount = wallet.deployed ? await walletContract.txCount(): 0;
    const beforeTime = (await this._web3.eth.getBlock('latest')).timestamp + timeLimit;
    const signature = await this.sign(wallet.owner,
      web3.utils.soliditySha3(
        wallet.address, to, data, feeToken, feeValue, txCount, beforeTime
      )
    );
    let _to, _data;

    if (!wallet.deployed) {
      _data = this._walletFactory.methods.deployWallet(to, data, feeToken, feeTo, feeValue, beforeTime, wallet.owner, signature).encodeABI();
      _to = this._walletFactory._address;
    } else {
      _data = walletContract.methods.call(to, data, feeToken, feeTo, feeValue, beforeTime, signature).encodeABI();
      _to = wallet.address;
    }
    const txSigned = await this.signETHTransaction({ from: wallet.owner, to: _to, data: _data, chainId: chainId, gasPrice: gasPrice });
    return web3.eth.sendSignedTransaction(txSigned);
  }

  /**
   * Relay a signed quickTransaction from owner address
   * @return Object
   */
  async relayTransaction ({
    from, quickTransaction, chainId, gasPrice, gasLimit
  }) {
    const walletContract = new web3.eth.Contract(walletABI, quickTransaction.from);
    let _to, _data;
    if ((await web3.eth.getCode(quickTransaction.from)) == '0x') {
      _data = this._walletFactory.methods.deployWallet(
        quickTransaction.to,
        quickTransaction.data,
        quickTransaction.feeToken,
        from,
        quickTransaction.feeValue,
        quickTransaction.beforeTime,
        quickTransaction.owner,
        quickTransaction.signature
      ).encodeABI();
      _to = this._walletFactory._address;
    } else {
      _data = walletContract.methods.call(
        quickTransaction.to,
        quickTransaction.data,
        quickTransaction.feeToken,
        from,
        quickTransaction.feeValue,
        quickTransaction.beforeTime,
        quickTransaction.signature
      ).encodeABI();
      _to = quickTransaction.from;
    }
    const txSigned = await this.signETHTransaction({
      from: from, to: _to, data: _data, chainId: chainId, gasPrice: gasPrice, gasLimit: gasLimit
    });
    return web3.eth.sendSignedTransaction(txSigned);
  }

  /**
   * Send transaction from owner address
   * @return Object
   */
  async sendTransactionFromOwner ({from, to, data, gasLimit, chainId, gasPrice}) {
    const txSigned = await this.signETHTransaction({ from: from, to: to, data: data, gasLimit: gasLimit, chainId: chainId, gasPrice: gasPrice });
    return web3.eth.sendSignedTransaction(txSigned);
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
    const { wallet } = this._children.find(({ owner }) => from === owner) || {}

    if (!wallet) {
      throw new Error('Invalid from address')
    }

    if (!nonce)
      nonce = await web3.eth.getTransactionCount(from);

    if (!gasPrice)
      gasPrice = await web3.eth.getGasPrice();

    if (!gasLimit)
      gasLimit = await web3.eth.estimateGas({ to: to, data: data });

    if (!chainId)
      chainId = await web3.eth.getChainId();

    const tx = new EthereumTx({
      nonce, to, value, data, gasLimit, gasPrice, chainId
    })

    tx.sign(wallet.getPrivateKey())
    return addHexPrefix(tx.serialize().toString('hex'))
  }

  /**
   * Sign quick transaction from owner address
   * @return Object
   */
  async signQuickTransaction ({from, to, data, feeToken, feeValue, timeLimit, txCount}) {
    const wallet = await this.getWallet(from);
    const walletContract = new web3.eth.Contract(walletABI, from);
    if (!txCount)
      txCount = wallet.deployed ? await walletContract.txCount(): 0;
    const beforeTime = (await this._web3.eth.getBlock('latest')).timestamp + timeLimit;
    const signature = await this.sign(wallet.owner,
      web3.utils.soliditySha3(
        wallet.address, to, data, feeToken, feeValue, txCount, beforeTime
      )
    );
    return {
      owner: wallet.owner,
      from: wallet.address,
      to: to,
      data: data,
      feeToken: feeToken,
      feeValue: feeValue,
      beforeTime: beforeTime,
      txCount: txCount,
      signature: signature
    };
  }

  /**
   * Get wallet info.
   *
   * @return Object
   */
  async getWallet (addr) {
    const wallet = this._children.find(({ address }) => addr === address);
    if (!wallet)
      throw("Invalid address")

    wallet.deployed = (await this._web3.eth.getCode(wallet.address) != '0x');
    wallet.balance = await this._web3.eth.getBalance(wallet.address);
    wallet.contract = new web3.eth.Contract(walletABI, wallet.address);

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
          this._walletFactory._address,
          this._web3.utils.soliditySha3(owner),
          walletBytecode + this._web3.eth.abi.encodeParameters(['address'], [owner]).substring(2)
        ),
      });
    };
    return this._children.slice(-num);
  }
}
