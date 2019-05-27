'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.QuickWallet = exports.generateMnemonic = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _hdkey = require('ethereumjs-wallet/hdkey');

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

var _ethSigUtil = require('eth-sig-util');

var _ethSigUtil2 = _interopRequireDefault(_ethSigUtil);

var _bitcoreMnemonic = require('bitcore-mnemonic');

var _bitcoreMnemonic2 = _interopRequireDefault(_bitcoreMnemonic);

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _Wallet = require('../build/contracts/Wallet.json');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var web3 = new _web2.default();

// See https://github.com/ethereum/EIPs/issues/85
var BIP44_PATH = 'm/44\'/60\'/0\'/0';

// Add 0x prefix to a string
var addHexPrefix = function addHexPrefix(text) {
  return '0x' + text;
};

// deterministically computes the smart contract address given
// the account the will deploy the contract (factory contract)
// the salt as uint256 and the contract bytecode
var buildCreate2Address = function buildCreate2Address(creatorAddress, saltHex, byteCode) {
  return web3.utils.toChecksumAddress('0x' + web3.utils.sha3('0x' + ['ff', creatorAddress, saltHex, web3.utils.soliditySha3(byteCode)].map(function (x) {
    return x.replace(/0x/, '');
  }).join('')).slice(-40));
};

// encodes parameter to pass as contract argument
var encodeParam = function encodeParam(dataType, data) {
  return web3.eth.abi.encodeParameter(dataType, data);
};

/**
 * Generate a 12-word mnemonic in English.
 * @return {[String]}
 */
var generateMnemonic = exports.generateMnemonic = function generateMnemonic() {
  return new _bitcoreMnemonic2.default(_bitcoreMnemonic2.default.Words.ENGLISH).toString();
};

/**
 * Represents a QuickWallet instance.
 */

var QuickWallet = exports.QuickWallet = function () {
  _createClass(QuickWallet, null, [{
    key: 'fromMnemonic',


    /**
     * Construct HD wallet instance from given mnemonic
     * @param  {String} mnemonic Mnemonic/seed string.
     * @return {QuickWallet}
     */
    value: function fromMnemonic(mnemonic, walletFactory) {
      var _toHDPrivateKey = new _bitcoreMnemonic2.default(mnemonic).toHDPrivateKey(),
          xprivkey = _toHDPrivateKey.xprivkey;

      return new QuickWallet(xprivkey, walletFactory);
    }

    /**
     * @constructor
     * @param  {String} hdKey Extended HD private key
     * @param  {String} The wallet factory address
     */

  }]);

  function QuickWallet(xPrivKey, walletFactory) {
    _classCallCheck(this, QuickWallet);

    this._walletFactory = walletFactory;
    this._walletBytecode = _Wallet.bytecode;
    this._hdKey = (0, _hdkey.fromExtendedKey)(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this._children = [];
  }

  /**
   * Generate new addresses.
   * @param  {Number} num No. of new addresses to generate.
   * @return {[String]}
   */


  _createClass(QuickWallet, [{
    key: 'generateAddresses',
    value: function generateAddresses(num) {
      var newKeys = this._deriveNewKeys(num);
      return newKeys.map(function (k) {
        return k.address;
      });
    }

    /**
     * Discard generated addresses.
     *
     * This is in effect the reverse of `generateAddresses()`.
     *
     * @param  {Number} num The number of addresses to remove from the end of the list of addresses.
     * @return {[String]} The discarded addresses
     */

  }, {
    key: 'discardAddresses',
    value: function discardAddresses(num) {
      var discard = this._children.splice(-num);
      return discard.map(function (k) {
        return k.address;
      });
    }

    /**
     * Get all addresses.
     * @return {[String]}
     */

  }, {
    key: 'getAddresses',
    value: function getAddresses() {
      return this._children.map(function (k) {
        return k.address;
      });
    }

    /**
     * Get all addresses.
     * @return {[String]}
     */

  }, {
    key: 'getWallets',
    value: function getWallets() {
      return this._children;
    }

    /**
     * Get no. of addresses.
     * @return {Number}
     */

  }, {
    key: 'getAddressCount',
    value: function getAddressCount() {
      return this._children.map(function (k) {
        return k.address;
      }).length;
    }

    /**
     * Check whether given address is present in current list of generated addresses.
     * @param  {String}  addr
     * @return {Boolean}
     */

  }, {
    key: 'hasAddress',
    value: function hasAddress(addr) {
      return !!this._children.find(function (_ref) {
        var address = _ref.address;
        return addr === address;
      });
    }

    /**
     * Sign transaction data.
     *
     * @param  {String} from From address
     * @param  {String} [to] If omitted then deploying a contract
     * @param  {Number} value Amount of wei to send
     * @param  {String} data Data
     * @param  {Number} gasLimit Total Gas to use
     * @param  {Number} gasPrice Gas price (wei per gas unit)
     * @param  {String} chainId Chain id
     *
     * @return {String} Raw transaction string.
     */

  }, {
    key: 'signTransaction',
    value: function signTransaction(_ref2) {
      var nonce = _ref2.nonce,
          from = _ref2.from,
          to = _ref2.to,
          value = _ref2.value,
          data = _ref2.data,
          gasLimit = _ref2.gasLimit,
          gasPrice = _ref2.gasPrice,
          chainId = _ref2.chainId;

      var _ref3 = this._children.find(function (_ref4) {
        var address = _ref4.address;
        return from === address;
      }) || {},
          wallet = _ref3.wallet;

      if (!wallet) throw new Error('Invalid from address');
      var tx = new _ethereumjsTx2.default({
        nonce: nonce, to: to, value: value, data: data, gasLimit: gasLimit, gasPrice: gasPrice, chainId: chainId
      });
      tx.sign(wallet.getPrivateKey());
      return addHexPrefix(tx.serialize().toString('hex'));
    }

    /**
     * Sign data.
     *
     * @param  {String} address Address whos private key to sign with
     * @param  {String|Buffer|BN} data Data
     *
     * @return {String} Signed data..
     */

  }, {
    key: 'sign',
    value: function sign(owner, data) {
      var _ref5 = this._children.find(function (_ref6) {
        var a = _ref6.owner;
        return owner === a;
      }) || {},
          wallet = _ref5.wallet;

      if (!wallet) throw new Error('Invalid address');
      return _ethSigUtil2.default.personalSign(wallet.getPrivateKey(), { data: data });
    }

    /**
     * Recover public key of signing account.
     *
     * @param  {String} signature The signed message..
     * @param  {String|Buffer|BN} data The original input data.
     *
     * @return {String} Public signing key.
     */

  }, {
    key: 'recoverSignerPublicKey',
    value: function recoverSignerPublicKey(signature, data) {
      return _ethSigUtil2.default.recoverPersonalSignature({ sig: signature, data: data });
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

  }, {
    key: '_deriveNewKeys',
    value: function _deriveNewKeys(num) {
      for (var i = num; i >= 0; i--) {
        var child = this._root.deriveChild(this._children.length).getWallet();
        var owner = addHexPrefix(child.getAddress().toString('hex'));
        this._children.push({
          wallet: child,
          owner: web3.utils.toChecksumAddress(owner),
          salt: web3.utils.sha3(child.getPublicKey()),
          address: buildCreate2Address(this._walletFactory, web3.utils.sha3(child.getPublicKey()), this._walletBytecode + web3.eth.abi.encodeParameters(['address'], [owner]).substring(2))
        });
      };
      return this._children.slice(-num);
    }
  }]);

  return QuickWallet;
}();