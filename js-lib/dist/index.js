"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _hdkey = require("ethereumjs-wallet/hdkey");

var _ethSigUtil = _interopRequireDefault(require("eth-sig-util"));

var _ethereumjsTx = _interopRequireDefault(require("ethereumjs-tx"));

var _bitcoreMnemonic = _interopRequireDefault(require("bitcore-mnemonic"));

var _web = _interopRequireDefault(require("web3"));

var _QuickWallet = require("../../smart-contracts/build/contracts/QuickWallet.json");

var _QuickWalletFactory = require("../../smart-contracts/build/contracts/QuickWalletFactory.json");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// See https://github.com/ethereum/EIPs/issues/85
var BIP44_PATH = 'm/44\'/60\'/0\'/0';
/**
 * Add the 0x prefix to a string if not preset
 * @param  String text
 * @return String
 */

var addHexPrefix = function addHexPrefix(text) {
  return !text.slice(0, 2) !== '0x' ? '0x' + text : text;
};
/**
 * Represents a QuickWallet instance.
 */


var QuickWallet =
/*#__PURE__*/
function () {
  _createClass(QuickWallet, null, [{
    key: "fromMnemonic",

    /**
     * Construct HD wallet instance from given mnemonic
     *
     * @param String mnemonic Mnemonic/seed string.
     * @param String QuickWallet factory address
     *
     * @return {QuickWallet}
     */
    value: function fromMnemonic(mnemonic, walletFactoryAddress) {
      var _toHDPrivateKey = new _bitcoreMnemonic["default"](mnemonic).toHDPrivateKey(),
          xprivkey = _toHDPrivateKey.xprivkey;

      return new QuickWallet(xprivkey, walletFactoryAddress);
    }
    /**
     * Generate a 12-word mnemonic in English.
     * @return {[String]}
     */

  }, {
    key: "generateMnemonic",
    value: function generateMnemonic() {
      return new _bitcoreMnemonic["default"](_bitcoreMnemonic["default"].Words.ENGLISH).toString();
    }
  }]);

  /**
   * @constructor
   *
   * @param String The HD master private key
   * @param String QuickWallet factory address
   * @param String Web3 provider url (Optional)
   */
  function QuickWallet(xPrivKey, walletFactoryAddress) {
    var web3Provider = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'http://localhost:8545';

    _classCallCheck(this, QuickWallet);

    this._web3 = new _web["default"](web3Provider, undefined, {
      transactionConfirmationBlocks: 1
    });
    this._walletFactory = new this._web3.eth.Contract(_QuickWalletFactory.abi, walletFactoryAddress);
    this._hdKey = (0, _hdkey.fromExtendedKey)(xPrivKey);
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


  _createClass(QuickWallet, [{
    key: "generateAddresses",
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
    key: "buildCreate2Address",
    value: function buildCreate2Address(creatorAddress, saltHex, byteCode) {
      return this._web3.utils.toChecksumAddress("0x".concat(this._web3.utils.sha3("0x".concat(['ff', creatorAddress, saltHex, this._web3.utils.soliditySha3(byteCode)].map(function (x) {
        return x.replace(/0x/, '');
      }).join(''))).slice(-40)));
    }
  }, {
    key: "discardAddresses",

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
    key: "getAddresses",
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
    key: "getQuickWallets",
    value: function getQuickWallets() {
      return this._children.map(function (k) {
        return {
          address: k.address,
          owner: k.owner
        };
      });
    }
    /**
     * Get wallet info.
     *
     * @return Object
     */

  }, {
    key: "getQuickWallet",
    value: function () {
      var _getQuickWallet = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(addr) {
        var wallet;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                wallet = this._children.find(function (_ref) {
                  var address = _ref.address;
                  return addr === address;
                });

                if (wallet) {
                  _context.next = 3;
                  break;
                }

                throw new Error('Invalid quick wallet address');

              case 3:
                _context.next = 5;
                return this._web3.eth.getCode(wallet.address);

              case 5:
                _context.t0 = _context.sent;
                wallet.deployed = _context.t0 !== '0x';
                _context.next = 9;
                return this._web3.eth.getBalance(wallet.address);

              case 9:
                wallet.balance = _context.sent;
                wallet.contract = new this._web3.eth.Contract(_QuickWallet.abi, wallet.address);
                return _context.abrupt("return", wallet);

              case 12:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function getQuickWallet(_x) {
        return _getQuickWallet.apply(this, arguments);
      }

      return getQuickWallet;
    }()
    /**
     * Get no. of addresses.
     *
     * @return Number
     */

  }, {
    key: "getAddressCount",
    value: function getAddressCount() {
      return this._children.map(function (k) {
        return k.address;
      }).length;
    }
    /**
     * Send transaction from owner address
     * @return Object
     */

  }, {
    key: "sendTransaction",
    value: function () {
      var _sendTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(_ref2) {
        var from, to, data, feeToken, feeTo, feeValue, timeLimit, chainId, gasPrice, wallet, walletContract, txCount, beforeTime, txData, txSig, _to, _data, txSigned;

        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                from = _ref2.from, to = _ref2.to, data = _ref2.data, feeToken = _ref2.feeToken, feeTo = _ref2.feeTo, feeValue = _ref2.feeValue, timeLimit = _ref2.timeLimit, chainId = _ref2.chainId, gasPrice = _ref2.gasPrice;
                _context2.next = 3;
                return this.getQuickWallet(from);

              case 3:
                wallet = _context2.sent;
                walletContract = new this._web3.eth.Contract(_QuickWallet.abi, from);

                if (!wallet.deployed) {
                  _context2.next = 11;
                  break;
                }

                _context2.next = 8;
                return walletContract.txCount();

              case 8:
                _context2.t0 = _context2.sent;
                _context2.next = 12;
                break;

              case 11:
                _context2.t0 = 0;

              case 12:
                txCount = _context2.t0;
                _context2.next = 15;
                return this._web3.eth.getBlock('latest');

              case 15:
                _context2.t1 = _context2.sent.timestamp;
                _context2.t2 = timeLimit;
                beforeTime = _context2.t1 + _context2.t2;
                txData = this._web3.eth.abi.encodeParameters(['address', 'bytes', 'address', 'uint256', 'uint256'], [to, data, feeToken, feeValue, beforeTime]);
                _context2.next = 21;
                return this.sign(wallet.owner, this._web3.utils.soliditySha3(wallet.address, txData, txCount));

              case 21:
                txSig = _context2.sent;

                if (!wallet.deployed) {
                  _data = this._walletFactory.methods.deployQuickWallet(wallet.owner, txData, txSig, wallet.owner).encodeABI();
                  _to = this._walletFactory.address;
                } else {
                  _data = walletContract.methods.call(txData, txSig, wallet.owner).encodeABI();
                  _to = wallet.address;
                }

                _context2.next = 25;
                return this.signETHTransaction({
                  from: wallet.owner,
                  to: _to,
                  data: _data,
                  chainId: chainId,
                  gasPrice: gasPrice
                });

              case 25:
                txSigned = _context2.sent;
                return _context2.abrupt("return", this._web3.eth.sendSignedTransaction(txSigned));

              case 27:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this);
      }));

      function sendTransaction(_x2) {
        return _sendTransaction.apply(this, arguments);
      }

      return sendTransaction;
    }()
    /**
     * Relay a signed quickTransaction from owner address
     * @return Object
     */

  }, {
    key: "relayTransaction",
    value: function () {
      var _relayTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee3(_ref3) {
        var from, quickTransaction, chainId, gasPrice, gasLimit, walletContract, to, data, txSigned;
        return regeneratorRuntime.wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                from = _ref3.from, quickTransaction = _ref3.quickTransaction, chainId = _ref3.chainId, gasPrice = _ref3.gasPrice, gasLimit = _ref3.gasLimit;
                walletContract = new this._web3.eth.Contract(_QuickWallet.abi, quickTransaction.from);
                _context3.next = 4;
                return this._web3.eth.getCode(quickTransaction.from);

              case 4:
                _context3.t0 = _context3.sent;

                if (!(_context3.t0 === '0x')) {
                  _context3.next = 10;
                  break;
                }

                data = this._walletFactory.methods.deployQuickWallet(quickTransaction.owner, quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
                to = this._walletFactory.address;
                _context3.next = 12;
                break;

              case 10:
                data = walletContract.methods.call(quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
                to = quickTransaction.from;

              case 12:
                _context3.next = 14;
                return this.signETHTransaction({
                  from: from,
                  to: to,
                  data: data,
                  gasPrice: gasPrice,
                  gasLimit: gasLimit
                });

              case 14:
                txSigned = _context3.sent;
                return _context3.abrupt("return", this._web3.eth.sendSignedTransaction(txSigned));

              case 16:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function relayTransaction(_x3) {
        return _relayTransaction.apply(this, arguments);
      }

      return relayTransaction;
    }()
    /**
     * Relay a signed quickTransaction from owner address
     * @return Object
     */

  }, {
    key: "estimateRelayCost",
    value: function () {
      var _estimateRelayCost = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee4(_ref4) {
        var from, quickTransaction, walletContract, to, data;
        return regeneratorRuntime.wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                from = _ref4.from, quickTransaction = _ref4.quickTransaction;
                walletContract = new this._web3.eth.Contract(_QuickWallet.abi, quickTransaction.from);
                _context4.next = 4;
                return this._web3.eth.getCode(quickTransaction.from);

              case 4:
                _context4.t0 = _context4.sent;

                if (!(_context4.t0 === '0x')) {
                  _context4.next = 10;
                  break;
                }

                data = this._walletFactory.methods.deployQuickWallet(quickTransaction.owner, quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
                to = this._walletFactory.address;
                _context4.next = 12;
                break;

              case 10:
                data = walletContract.methods.call(quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
                to = quickTransaction.from;

              case 12:
                return _context4.abrupt("return", this._web3.eth.estimateGas({
                  from: from,
                  to: to,
                  data: data
                }));

              case 13:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function estimateRelayCost(_x4) {
        return _estimateRelayCost.apply(this, arguments);
      }

      return estimateRelayCost;
    }()
    /**
     * Send transaction from owner address
     * @return Object
     */

  }, {
    key: "sendTransactionFromOwner",
    value: function () {
      var _sendTransactionFromOwner = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(_ref5) {
        var from, to, data, gasLimit, chainId, gasPrice, txSigned;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                from = _ref5.from, to = _ref5.to, data = _ref5.data, gasLimit = _ref5.gasLimit, chainId = _ref5.chainId, gasPrice = _ref5.gasPrice;
                _context5.next = 3;
                return this.signETHTransaction({
                  from: from,
                  to: to,
                  data: data,
                  gasLimit: gasLimit,
                  chainId: chainId,
                  gasPrice: gasPrice
                });

              case 3:
                txSigned = _context5.sent;
                return _context5.abrupt("return", this._web3.eth.sendSignedTransaction(txSigned));

              case 5:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function sendTransactionFromOwner(_x5) {
        return _sendTransactionFromOwner.apply(this, arguments);
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
    key: "signETHTransaction",
    value: function () {
      var _signETHTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(_ref6) {
        var nonce, from, to, value, data, gasLimit, gasPrice, chainId, _ref7, wallet, tx;

        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                nonce = _ref6.nonce, from = _ref6.from, to = _ref6.to, value = _ref6.value, data = _ref6.data, gasLimit = _ref6.gasLimit, gasPrice = _ref6.gasPrice, chainId = _ref6.chainId;
                _ref7 = this._children.find(function (_ref8) {
                  var owner = _ref8.owner;
                  return from === owner;
                }) || {}, wallet = _ref7.wallet;

                if (wallet) {
                  _context6.next = 4;
                  break;
                }

                throw new Error('Invalid from address');

              case 4:
                if (nonce) {
                  _context6.next = 8;
                  break;
                }

                _context6.next = 7;
                return this._web3.eth.getTransactionCount(from);

              case 7:
                nonce = _context6.sent;

              case 8:
                if (gasPrice) {
                  _context6.next = 12;
                  break;
                }

                _context6.next = 11;
                return this._web3.eth.getGasPrice();

              case 11:
                gasPrice = _context6.sent;

              case 12:
                if (gasLimit) {
                  _context6.next = 16;
                  break;
                }

                _context6.next = 15;
                return this._web3.eth.estimateGas({
                  to: to,
                  data: data
                });

              case 15:
                gasLimit = _context6.sent;

              case 16:
                tx = new _ethereumjsTx["default"]({
                  nonce: nonce,
                  to: to,
                  value: value,
                  data: data,
                  gasLimit: gasLimit,
                  gasPrice: gasPrice,
                  chainId: chainId
                });
                tx.sign(wallet.getPrivateKey());
                return _context6.abrupt("return", addHexPrefix(tx.serialize().toString('hex')));

              case 19:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function signETHTransaction(_x6) {
        return _signETHTransaction.apply(this, arguments);
      }

      return signETHTransaction;
    }()
    /**
     * Sign quick transaction from owner address
     * @return Object
     */

  }, {
    key: "signQuickTransaction",
    value: function () {
      var _signQuickTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee7(_ref9) {
        var from, to, data, feeToken, feeValue, timeLimit, txCount, wallet, walletContract, beforeTime, txData, txSignature;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                from = _ref9.from, to = _ref9.to, data = _ref9.data, feeToken = _ref9.feeToken, feeValue = _ref9.feeValue, timeLimit = _ref9.timeLimit, txCount = _ref9.txCount;
                _context7.next = 3;
                return this.getQuickWallet(from);

              case 3:
                wallet = _context7.sent;
                walletContract = new this._web3.eth.Contract(_QuickWallet.abi, from);

                if (txCount) {
                  _context7.next = 14;
                  break;
                }

                if (!wallet.deployed) {
                  _context7.next = 12;
                  break;
                }

                _context7.next = 9;
                return walletContract.txCount();

              case 9:
                _context7.t0 = _context7.sent;
                _context7.next = 13;
                break;

              case 12:
                _context7.t0 = 0;

              case 13:
                txCount = _context7.t0;

              case 14:
                _context7.next = 16;
                return this._web3.eth.getBlock('latest');

              case 16:
                _context7.t1 = _context7.sent.timestamp;
                _context7.t2 = timeLimit;
                beforeTime = _context7.t1 + _context7.t2;
                txData = this._web3.eth.abi.encodeParameters(['address', 'bytes', 'address', 'uint256', 'uint256'], [to, data, feeToken, feeValue, beforeTime]);
                _context7.next = 22;
                return this.sign(wallet.owner, this._web3.utils.soliditySha3(wallet.address, txData, txCount));

              case 22:
                txSignature = _context7.sent;
                return _context7.abrupt("return", {
                  owner: wallet.owner,
                  from: wallet.address,
                  txData: txData,
                  txSignature: txSignature
                });

              case 24:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function signQuickTransaction(_x7) {
        return _signQuickTransaction.apply(this, arguments);
      }

      return signQuickTransaction;
    }()
    /**
     * Check whether given address is present in current list of generated addresses.
     *
     * @param String addr The wallet address to check
     *
     * @return Boolean
     */

  }, {
    key: "hasAddress",
    value: function hasAddress(addr) {
      return !!this._children.find(function (_ref10) {
        var address = _ref10.address;
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
    key: "hasOwner",
    value: function hasOwner(_owner) {
      return !!this._children.find(function (_ref11) {
        var owner = _ref11.owner;
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
    key: "sign",
    value: function sign(owner, data) {
      var _ref12 = this._children.find(function (_ref13) {
        var a = _ref13.owner;
        return owner === a;
      }) || {},
          wallet = _ref12.wallet;

      if (!wallet) {
        throw new Error('Invalid address');
      }

      return _ethSigUtil["default"].personalSign(wallet.getPrivateKey(), {
        data: data
      });
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
    key: "recoverSignerPublicKey",
    value: function recoverSignerPublicKey(signature, data) {
      return _ethSigUtil["default"].recoverPersonalSignature({
        sig: signature,
        data: data
      });
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
    key: "_deriveNewKeys",
    value: function _deriveNewKeys(num) {
      for (var i = num; i >= 0; i--) {
        var child = this._root.deriveChild(this._children.length).getWallet();

        var owner = addHexPrefix(child.getAddress().toString('hex'));

        this._children.push({
          wallet: child,
          owner: owner,
          address: this.buildCreate2Address(this._walletFactory.address, this._web3.utils.soliditySha3(owner), _QuickWallet.bytecode + this._web3.eth.abi.encodeParameters(['address'], [owner]).substring(2))
        });
      }

      ;
      return this._children.slice(-num);
    }
  }]);

  return QuickWallet;
}();

exports["default"] = QuickWallet;