import { fromExtendedKey } from 'ethereumjs-wallet/hdkey';
import EthSigUtil from 'eth-sig-util';
import Mnemonic from 'bitcore-mnemonic';
import Web3 from 'web3';
import { bytecode } from '../build/contracts/Wallet.json';
const web3 = new Web3();

// See https://github.com/ethereum/EIPs/issues/85
const BIP44_PATH = `m/44'/60'/0'/0`

// Add 0x prefix to a string
const addHexPrefix = (text) => {
  return '0x'+text;
}

// deterministically computes the smart contract address given
// the account the will deploy the contract (factory contract)
// the salt as uint256 and the contract bytecode
const buildCreate2Address = function (creatorAddress, saltHex, byteCode) {
  return web3.utils.toChecksumAddress(`0x${web3.utils.sha3(`0x${[
    'ff',
    creatorAddress,
    saltHex,
    web3.utils.soliditySha3(byteCode),
  ].map(x => x.replace(/0x/, '')).join('')}`).slice(-40)}`);
};

// encodes parameter to pass as contract argument
const encodeParam = function (dataType, data) {
  return web3.eth.abi.encodeParameter(dataType, data);
};

/**
 * Generate a 12-word mnemonic in English.
 * @return {[String]}
 */
export const generateMnemonic = () => {
  return new Mnemonic(Mnemonic.Words.ENGLISH).toString();
}


/**
 * Represents a QuickWallet instance.
 */
export class QuickWallet {

  /**
   * Construct HD wallet instance from given mnemonic
   * @param  {String} mnemonic Mnemonic/seed string.
   * @return {QuickWallet}
   */
  static fromMnemonic (mnemonic, walletFactory) {
    const { xprivkey } = new Mnemonic(mnemonic).toHDPrivateKey();
    return new QuickWallet(xprivkey, walletFactory);
  }

  /**
   * @constructor
   * @param  {String} hdKey Extended HD private key
   * @param  {String} The wallet factory address
   */
  constructor (xPrivKey, walletFactory) {
    this._walletFactory = walletFactory;
    this._walletBytecode = bytecode;
    this._hdKey = fromExtendedKey(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this._children = [];
  }

  /**
   * Generate new addresses.
   * @param  {Number} num No. of new addresses to generate.
   * @return {[String]}
   */
  generateAddresses (num) {
    const newKeys = this._deriveNewKeys(num);
    return newKeys.map(k => k.address);
  }

  /**
   * Discard generated addresses.
   *
   * This is in effect the reverse of `generateAddresses()`.
   *
   * @param  {Number} num The number of addresses to remove from the end of the list of addresses.
   * @return {[String]} The discarded addresses
   */
  discardAddresses (num) {
    const discard = this._children.splice(-num);
    return discard.map(k => k.address);
  }

  /**
   * Get all addresses.
   * @return {[String]}
   */
  getAddresses () {
    return this._children.map(k => k.address);
  }

  /**
   * Get all addresses.
   * @return {[String]}
   */
  getWallets () {
    return this._children.map(k => {k.address, k.owner, k.salt});
  }

  /**
   * Get no. of addresses.
   * @return {Number}
   */
  getAddressCount () {
    return this._children.map(k => k.address).length;
  }

  /**
   * Check whether given address is present in current list of generated addresses.
   * @param  {String}  addr
   * @return {Boolean}
   */
  hasAddress (addr) {
    return !!this._children.find(({ address }) => addr === address);
  }


  /**
   * Sign data.
   *
   * @param  {String} address Address whos private key to sign with
   * @param  {String|Buffer|BN} data Data
   *
   * @return {String} Signed data..
   */
  sign (owner, data) {
    const { wallet } = this._children.find(({ owner: a }) => owner === a) || {};
    if (!wallet)
      throw new Error('Invalid address');
    return EthSigUtil.personalSign(wallet.getPrivateKey(), { data });
  }


  /**
   * Recover public key of signing account.
   *
   * @param  {String} signature The signed message..
   * @param  {String|Buffer|BN} data The original input data.
   *
   * @return {String} Public signing key.
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
   * @param  {Number} num no. of new keypairs to generate
   * @return {[String]} Generated keypairs.
   */
  _deriveNewKeys (num) {
    for (let i = num; i >= 0; i--) {
      const child = this._root.deriveChild(this._children.length).getWallet();
      const owner = addHexPrefix(child.getAddress().toString('hex'));
      this._children.push({
        wallet: child,
        owner: web3.utils.toChecksumAddress(owner),
        salt: web3.utils.sha3(child.getPublicKey()),
        address: buildCreate2Address(
          this._walletFactory,
          web3.utils.sha3(child.getPublicKey()),
          this._walletBytecode + web3.eth.abi.encodeParameters(['address'], [owner]).substring(2)
        )
      });
    };
    return this._children.slice(-num);
  }
}
