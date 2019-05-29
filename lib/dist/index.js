'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.QuickWallet = exports.generateMnemonic = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _hdkey = require('ethereumjs-wallet/hdkey');

var _ethSigUtil = require('eth-sig-util');

var _ethSigUtil2 = _interopRequireDefault(_ethSigUtil);

var _ethereumjsTx = require('ethereumjs-tx');

var _ethereumjsTx2 = _interopRequireDefault(_ethereumjsTx);

var _bitcoreMnemonic = require('bitcore-mnemonic');

var _bitcoreMnemonic2 = _interopRequireDefault(_bitcoreMnemonic);

var _web = require('web3');

var _web2 = _interopRequireDefault(_web);

var _Wallet = require('../../build/contracts/Wallet.json');

var _WalletFactory = require('../../build/contracts/WalletFactory.json');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// See https://github.com/ethereum/EIPs/issues/85
var BIP44_PATH = 'm/44\'/60\'/0\'/0';

/**
 * Add the 0x prefix to a string if not preset
 * @param  String text
 * @return String
 */var addHexPrefix = function addHexPrefix(text) {
  return !text.slice(0, 2) != '0x' ? '0x' + text : text;
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
     *
     * @param String mnemonic Mnemonic/seed string.
     * @param String Wallet factory address
     *
     * @return {QuickWallet}
     */
    value: function fromMnemonic(mnemonic, walletFactoryAddress) {
      var _toHDPrivateKey = new _bitcoreMnemonic2.default(mnemonic).toHDPrivateKey(),
          xprivkey = _toHDPrivateKey.xprivkey;

      return new QuickWallet(xprivkey, walletFactoryAddress);
    }

    /**
     * @constructor
     *
     * @param String The HD master private key
     * @param String Wallet factory address
     * @param String Web3 provider url (Optional)
     */

  }]);

  function QuickWallet(xPrivKey, walletFactoryAddress) {
    var web3Provider = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'http://localhost:8545';

    _classCallCheck(this, QuickWallet);

    this._walletFactory = new web3.eth.Contract(_WalletFactory.abi, walletFactoryAddress);
    this._hdKey = (0, _hdkey.fromExtendedKey)(xPrivKey);
    this._root = this._hdKey.derivePath(BIP44_PATH);
    this._children = [];
    this._web3 = new _web2.default(web3Provider);
  }

  /**
   * Generate new addresses.
   *
   * @param Number num No. of new addresses to generate.
   *
   * @return [String]
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
     * Deterministically computes the smart contract address
     *
     * @param String ncreatorAddress The address of the creator contract
     * @param String saltHex The salt to be used in hex format
     * @param String byteCode The bytecode of the smart contract to create
     */

  }, {
    key: 'buildCreate2Address',
    value: function buildCreate2Address(creatorAddress, saltHex, byteCode) {
      return this._web3.utils.toChecksumAddress('0x' + this._web3.utils.sha3('0x' + ['ff', creatorAddress, saltHex, this._web3.utils.soliditySha3(byteCode)].map(function (x) {
        return x.replace(/0x/, '');
      }).join('')).slice(-40));
    }
  }, {
    key: 'discardAddresses',


    /**
     * Discard generated addresses.
     *
     * @param Number num The number of addresses to remove from the end of the list of addresses.
     *
     * @return [String] The discarded addresses
     */
    value: function discardAddresses(num) {
      var discard = this._children.splice(-num);
      return discard.map(function (k) {
        return k.address;
      });
    }

    /**
     * Get all addresses.
     * @return [String]
     */

  }, {
    key: 'getAddresses',
    value: function getAddresses() {
      return this._children.map(function (k) {
        return k.address;
      });
    }

    /**
     * Get all wallets.
     * @return [Object]
     */

  }, {
    key: 'getWallets',
    value: function getWallets() {
      return this._children.map(function (k) {
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

  }, {
    key: 'sendTransaction',
    value: function () {
      var _ref2 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee(_ref) {
        var from = _ref.from,
            to = _ref.to,
            data = _ref.data,
            feeToken = _ref.feeToken,
            feeTo = _ref.feeTo,
            feeValue = _ref.feeValue,
            timeLimit = _ref.timeLimit,
            chainId = _ref.chainId,
            gasPrice = _ref.gasPrice;

        var wallet, walletContract, txCount, beforeTime, signature, _to, _data, txSigned;

        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _context.next = 2;
                return this.getWallet(from);

              case 2:
                wallet = _context.sent;
                walletContract = new web3.eth.Contract(_Wallet.abi, from);

                if (!wallet.deployed) {
                  _context.next = 10;
                  break;
                }

                _context.next = 7;
                return walletContract.txCount();

              case 7:
                _context.t0 = _context.sent;
                _context.next = 11;
                break;

              case 10:
                _context.t0 = 0;

              case 11:
                txCount = _context.t0;
                _context.next = 14;
                return this._web3.eth.getBlock('latest');

              case 14:
                _context.t1 = _context.sent.timestamp;
                _context.t2 = timeLimit;
                beforeTime = _context.t1 + _context.t2;
                _context.next = 19;
                return this.sign(wallet.owner, web3.utils.soliditySha3(wallet.address, to, data, feeToken, feeValue, txCount, beforeTime));

              case 19:
                signature = _context.sent;
                _to = void 0, _data = void 0;


                if (!wallet.deployed) {
                  _data = this._walletFactory.methods.deployWallet(to, data, feeToken, feeTo, feeValue, beforeTime, wallet.owner, signature).encodeABI();
                  _to = this._walletFactory._address;
                } else {
                  _data = walletContract.methods.call(to, data, feeToken, feeTo, feeValue, beforeTime, signature).encodeABI();
                  _to = wallet.address;
                }
                _context.next = 24;
                return this.signETHTransaction({ from: wallet.owner, to: _to, data: _data, chainId: chainId, gasPrice: gasPrice });

              case 24:
                txSigned = _context.sent;
                return _context.abrupt('return', web3.eth.sendSignedTransaction(txSigned));

              case 26:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function sendTransaction(_x2) {
        return _ref2.apply(this, arguments);
      }

      return sendTransaction;
    }()

    /**
     * Relay a signed quickTransaction from owner address
     * @return Object
     */

  }, {
    key: 'relayTransaction',
    value: function () {
      var _ref4 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee2(_ref3) {
        var from = _ref3.from,
            quickTransaction = _ref3.quickTransaction,
            chainId = _ref3.chainId,
            gasPrice = _ref3.gasPrice,
            gasLimit = _ref3.gasLimit;

        var walletContract, _to, _data, txSigned;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                walletContract = new web3.eth.Contract(_Wallet.abi, quickTransaction.from);
                _to = void 0, _data = void 0;
                _context2.next = 4;
                return web3.eth.getCode(quickTransaction.from);

              case 4:
                _context2.t0 = _context2.sent;

                if (!(_context2.t0 == '0x')) {
                  _context2.next = 10;
                  break;
                }

                _data = this._walletFactory.methods.deployWallet(quickTransaction.to, quickTransaction.data, quickTransaction.feeToken, from, quickTransaction.feeValue, quickTransaction.beforeTime, quickTransaction.owner, quickTransaction.signature).encodeABI();
                _to = this._walletFactory._address;
                _context2.next = 12;
                break;

              case 10:
                _data = walletContract.methods.call(quickTransaction.to, quickTransaction.data, quickTransaction.feeToken, from, quickTransaction.feeValue, quickTransaction.beforeTime, quickTransaction.signature).encodeABI();
                _to = quickTransaction.from;

              case 12:
                _context2.next = 14;
                return this.signETHTransaction({
                  from: from, to: _to, data: _data, chainId: chainId, gasPrice: gasPrice, gasLimit: gasLimit
                });

              case 14:
                txSigned = _context2.sent;
                return _context2.abrupt('return', web3.eth.sendSignedTransaction(txSigned));

              case 16:
              case 'end':
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function relayTransaction(_x3) {
        return _ref4.apply(this, arguments);
      }

      return relayTransaction;
    }()

    /**
     * Send transaction from owner address
     * @return Object
     */

  }, {
    key: 'sendTransactionFromOwner',
    value: function () {
      var _ref6 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee3(_ref5) {
        var from = _ref5.from,
            to = _ref5.to,
            data = _ref5.data,
            gasLimit = _ref5.gasLimit,
            chainId = _ref5.chainId,
            gasPrice = _ref5.gasPrice;
        var txSigned;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.signETHTransaction({ from: from, to: to, data: data, gasLimit: gasLimit, chainId: chainId, gasPrice: gasPrice });

              case 2:
                txSigned = _context3.sent;
                return _context3.abrupt('return', web3.eth.sendSignedTransaction(txSigned));

              case 4:
              case 'end':
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function sendTransactionFromOwner(_x4) {
        return _ref6.apply(this, arguments);
      }

      return sendTransactionFromOwner;
    }()

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

  }, {
    key: 'signETHTransaction',
    value: function () {
      var _ref8 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee4(_ref7) {
        var nonce = _ref7.nonce,
            from = _ref7.from,
            to = _ref7.to,
            value = _ref7.value,
            data = _ref7.data,
            gasLimit = _ref7.gasLimit,
            gasPrice = _ref7.gasPrice,
            chainId = _ref7.chainId;

        var _ref9, wallet, tx;

        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                _ref9 = this._children.find(function (_ref10) {
                  var owner = _ref10.owner;
                  return from === owner;
                }) || {}, wallet = _ref9.wallet;

                if (wallet) {
                  _context4.next = 3;
                  break;
                }

                throw new Error('Invalid from address');

              case 3:
                if (nonce) {
                  _context4.next = 7;
                  break;
                }

                _context4.next = 6;
                return web3.eth.getTransactionCount(from);

              case 6:
                nonce = _context4.sent;

              case 7:
                if (gasPrice) {
                  _context4.next = 11;
                  break;
                }

                _context4.next = 10;
                return web3.eth.getGasPrice();

              case 10:
                gasPrice = _context4.sent;

              case 11:
                if (gasLimit) {
                  _context4.next = 15;
                  break;
                }

                _context4.next = 14;
                return web3.eth.estimateGas({ to: to, data: data });

              case 14:
                gasLimit = _context4.sent;

              case 15:
                if (chainId) {
                  _context4.next = 19;
                  break;
                }

                _context4.next = 18;
                return web3.eth.getChainId();

              case 18:
                chainId = _context4.sent;

              case 19:
                tx = new _ethereumjsTx2.default({
                  nonce: nonce, to: to, value: value, data: data, gasLimit: gasLimit, gasPrice: gasPrice, chainId: chainId
                });


                tx.sign(wallet.getPrivateKey());
                return _context4.abrupt('return', addHexPrefix(tx.serialize().toString('hex')));

              case 22:
              case 'end':
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function signETHTransaction(_x5) {
        return _ref8.apply(this, arguments);
      }

      return signETHTransaction;
    }()

    /**
     * Sign quick transaction from owner address
     * @return Object
     */

  }, {
    key: 'signQuickTransaction',
    value: function () {
      var _ref12 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee5(_ref11) {
        var from = _ref11.from,
            to = _ref11.to,
            data = _ref11.data,
            feeToken = _ref11.feeToken,
            feeValue = _ref11.feeValue,
            timeLimit = _ref11.timeLimit,
            txCount = _ref11.txCount;
        var wallet, walletContract, beforeTime, signature;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.getWallet(from);

              case 2:
                wallet = _context5.sent;
                walletContract = new web3.eth.Contract(_Wallet.abi, from);

                if (txCount) {
                  _context5.next = 13;
                  break;
                }

                if (!wallet.deployed) {
                  _context5.next = 11;
                  break;
                }

                _context5.next = 8;
                return walletContract.txCount();

              case 8:
                _context5.t0 = _context5.sent;
                _context5.next = 12;
                break;

              case 11:
                _context5.t0 = 0;

              case 12:
                txCount = _context5.t0;

              case 13:
                _context5.next = 15;
                return this._web3.eth.getBlock('latest');

              case 15:
                _context5.t1 = _context5.sent.timestamp;
                _context5.t2 = timeLimit;
                beforeTime = _context5.t1 + _context5.t2;
                _context5.next = 20;
                return this.sign(wallet.owner, web3.utils.soliditySha3(wallet.address, to, data, feeToken, feeValue, txCount, beforeTime));

              case 20:
                signature = _context5.sent;
                return _context5.abrupt('return', {
                  owner: wallet.owner,
                  from: wallet.address,
                  to: to,
                  data: data,
                  feeToken: feeToken,
                  feeValue: feeValue,
                  beforeTime: beforeTime,
                  txCount: txCount,
                  signature: signature
                });

              case 22:
              case 'end':
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function signQuickTransaction(_x6) {
        return _ref12.apply(this, arguments);
      }

      return signQuickTransaction;
    }()

    /**
     * Get wallet info.
     *
     * @return Object
     */

  }, {
    key: 'getWallet',
    value: function () {
      var _ref13 = _asyncToGenerator( /*#__PURE__*/regeneratorRuntime.mark(function _callee6(addr) {
        var wallet;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                wallet = this._children.find(function (_ref14) {
                  var address = _ref14.address;
                  return addr === address;
                });

                if (wallet) {
                  _context6.next = 3;
                  break;
                }

                throw "Invalid address";

              case 3:
                _context6.next = 5;
                return this._web3.eth.getCode(wallet.address);

              case 5:
                _context6.t0 = _context6.sent;
                wallet.deployed = _context6.t0 != '0x';
                _context6.next = 9;
                return this._web3.eth.getBalance(wallet.address);

              case 9:
                wallet.balance = _context6.sent;

                wallet.contract = new web3.eth.Contract(_Wallet.abi, wallet.address);

                return _context6.abrupt('return', wallet);

              case 12:
              case 'end':
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function getWallet(_x7) {
        return _ref13.apply(this, arguments);
      }

      return getWallet;
    }()

    /**
     * Get no. of addresses.
     *
     * @return Number
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
     *
     * @param String addr The wallet address to check
     *
     * @return Boolean
     */

  }, {
    key: 'hasAddress',
    value: function hasAddress(addr) {
      return !!this._children.find(function (_ref15) {
        var address = _ref15.address;
        return addr === address;
      });
    }

    /**
     * Check whether given address is present in current list of generated addresses.
     *
     * @param String addr The owner address to check
     *
     * @return Boolean
     */

  }, {
    key: 'hasOwner',
    value: function hasOwner(_owner) {
      return !!this._children.find(function (_ref16) {
        var owner = _ref16.owner;
        return _owner === owner;
      });
    }

    /**
     * Sign data.
     *
     * @param String address Address whos private key to sign with
     * @param String|Buffer|BN data Data
     *
     * @return String Signed data
     */

  }, {
    key: 'sign',
    value: function sign(owner, data) {
      var _ref17 = this._children.find(function (_ref18) {
        var a = _ref18.owner;
        return owner === a;
      }) || {},
          wallet = _ref17.wallet;

      if (!wallet) {
        throw new Error('Invalid address');
      }
      return _ethSigUtil2.default.personalSign(wallet.getPrivateKey(), { data: data });
    }

    /**
     * Recover public key of signing account.
     *
     * @param String signature The signed message
     * @param String|Buffer|BN data The original input data
     *
     * @return String Public signing key
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
     * @param Number num no. of new keypairs to generate
     *
     * @return [String] Generated keypairs.
     */

  }, {
    key: '_deriveNewKeys',
    value: function _deriveNewKeys(num) {
      for (var i = num; i >= 0; i--) {
        var child = this._root.deriveChild(this._children.length).getWallet();
        var owner = addHexPrefix(child.getAddress().toString('hex'));
        this._children.push({
          wallet: child,
          owner: owner,
          address: this.buildCreate2Address(this._walletFactory._address, this._web3.utils.soliditySha3(owner), _Wallet.bytecode + this._web3.eth.abi.encodeParameters(['address'], [owner]).substring(2))
        });
      };
      return this._children.slice(-num);
    }
  }]);

  return QuickWallet;
}();