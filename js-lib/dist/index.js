"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

require("babel-polyfill");

var _hdkey = require("ethereumjs-wallet/hdkey");

var _ethSigUtil = _interopRequireDefault(require("eth-sig-util"));

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
      transactionConfirmationBlocks: 1,
      defaultHardfork: 'constantinople'
    });
    this._walletFactory = new this._web3.eth.Contract(_QuickWalletFactory.abi, walletFactoryAddress);

    if (!this._walletFactory.address) {
      this._walletFactory.address = this._walletFactory._address;
    }

    this._hdKey = (0, _hdkey.fromExtendedKey)(xPrivKey);
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


  _createClass(QuickWallet, [{
    key: "generateAddresses",
    value: function generateAddresses(num) {
      var newKeys = this._deriveNewKeys(num);

      return newKeys.map(function (k) {
        return k.secondaryAddress;
      });
    }
    /**
    * Remove a generated addresses.
    *
    * @param The address to be removed from the list of addresses.
    *
    * @return [String] The address to remove
    */

  }, {
    key: "removeAddress",
    value: function removeAddress(secondaryAddress) {
      this.wallets.splice(this.wallets.findIndex(function (w) {
        return w.secondaryAddress;
      }), 1);
    }
    /**
     * Get all quickwallets addresses and owners.
     * @return [Object]
     */

  }, {
    key: "getQuickWallets",
    value: function getQuickWallets() {
      return this.wallets;
    }
    /**
     * Get the quickwallet info.
     *
     * @return Object
     */

  }, {
    key: "getQuickWalletInfo",
    value: function () {
      var _getQuickWalletInfo = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee(secondaryAddr) {
        var quickWallet;
        return regeneratorRuntime.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                quickWallet = this.wallets.find(function (_ref) {
                  var secondaryAddress = _ref.secondaryAddress;
                  return secondaryAddress === secondaryAddr;
                });

                if (quickWallet) {
                  _context.next = 3;
                  break;
                }

                throw new Error('Invalid quick quickWallet address');

              case 3:
                _context.next = 5;
                return this._web3.eth.getCode(quickWallet.secondaryAddress);

              case 5:
                _context.t0 = _context.sent;
                quickWallet.deployed = _context.t0 !== '0x';
                _context.next = 9;
                return this._web3.eth.getBalance(quickWallet.secondaryAddress);

              case 9:
                quickWallet.balance = _context.sent;
                quickWallet.contract = new this._web3.eth.Contract(_QuickWallet.abi, quickWallet.secondaryAddress);
                return _context.abrupt("return", quickWallet);

              case 12:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function getQuickWalletInfo(_x) {
        return _getQuickWalletInfo.apply(this, arguments);
      }

      return getQuickWalletInfo;
    }()
    /**
     * Send transaction from primary address
     * @return Object
     */

  }, {
    key: "sendTransaction",
    value: function () {
      var _sendTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee2(_ref2) {
        var from, to, data, value, feeToken, feePayeer, feeValue, timeLimit, chainId, gasPrice, quickTransactionSigned;
        return regeneratorRuntime.wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                from = _ref2.from, to = _ref2.to, data = _ref2.data, value = _ref2.value, feeToken = _ref2.feeToken, feePayeer = _ref2.feePayeer, feeValue = _ref2.feeValue, timeLimit = _ref2.timeLimit, chainId = _ref2.chainId, gasPrice = _ref2.gasPrice;
                _context2.next = 3;
                return this.signQuickTransaction({
                  from: from,
                  to: to,
                  data: data,
                  value: value,
                  feeToken: feeToken,
                  feeValue: feeValue,
                  timeLimit: 60
                });

              case 3:
                quickTransactionSigned = _context2.sent;
                return _context2.abrupt("return", this.relayTransaction({
                  gasPrice: gasPrice,
                  from: feePayeer,
                  quickTransaction: quickTransactionSigned
                }));

              case 5:
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

                data = this._walletFactory.methods.deployQuickWallet(quickTransaction.primaryAddress, quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
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
                return _context3.abrupt("return", this._web3.eth.sendSignedTransaction(txSigned.rawTransaction));

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
     * @return Number
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

                data = this._walletFactory.methods.deployQuickWallet(quickTransaction.primaryAddress, quickTransaction.txData, quickTransaction.txSignature, from).encodeABI();
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

  }, {
    key: "signETHTransaction",
    value: function () {
      var _signETHTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee5(_ref5) {
        var nonce, from, to, value, data, gasLimit, gasPrice, chainId, wallet;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                nonce = _ref5.nonce, from = _ref5.from, to = _ref5.to, value = _ref5.value, data = _ref5.data, gasLimit = _ref5.gasLimit, gasPrice = _ref5.gasPrice, chainId = _ref5.chainId;
                wallet = this.wallets.find(function (_ref6) {
                  var primaryAddress = _ref6.primaryAddress;
                  return from === primaryAddress;
                }) || {};

                if (wallet) {
                  _context5.next = 4;
                  break;
                }

                throw new Error('Invalid from address');

              case 4:
                ;

                if (nonce) {
                  _context5.next = 9;
                  break;
                }

                _context5.next = 8;
                return this._web3.eth.getTransactionCount(from);

              case 8:
                nonce = _context5.sent;

              case 9:
                ;

                if (gasPrice) {
                  _context5.next = 14;
                  break;
                }

                _context5.next = 13;
                return this._web3.eth.getGasPrice();

              case 13:
                gasPrice = _context5.sent;

              case 14:
                ;

                if (!gasLimit) {
                  gasLimit = 6000000;
                }

                ;
                return _context5.abrupt("return", this._web3.eth.accounts.signTransaction({
                  nonce: nonce,
                  to: to,
                  value: value,
                  data: data,
                  gas: gasLimit,
                  gasPrice: gasPrice,
                  chainId: chainId
                }, addHexPrefix(wallet.getPrivateKey().toString('hex'))));

              case 18:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function signETHTransaction(_x5) {
        return _signETHTransaction.apply(this, arguments);
      }

      return signETHTransaction;
    }()
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
     */

  }, {
    key: "signQuickTransaction",
    value: function () {
      var _signQuickTransaction = _asyncToGenerator(
      /*#__PURE__*/
      regeneratorRuntime.mark(function _callee6(_ref7) {
        var from, to, data, value, feeToken, feeValue, timeLimit, txCount, wallet, walletContract, beforeTime, txData, txSignature;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                from = _ref7.from, to = _ref7.to, data = _ref7.data, value = _ref7.value, feeToken = _ref7.feeToken, feeValue = _ref7.feeValue, timeLimit = _ref7.timeLimit, txCount = _ref7.txCount;
                _context6.next = 3;
                return this.getQuickWalletInfo(from);

              case 3:
                wallet = _context6.sent;
                walletContract = new this._web3.eth.Contract(_QuickWallet.abi, from);

                if (txCount) {
                  _context6.next = 14;
                  break;
                }

                if (!wallet.deployed) {
                  _context6.next = 12;
                  break;
                }

                _context6.next = 9;
                return walletContract.methods.txCount().call();

              case 9:
                _context6.t0 = _context6.sent;
                _context6.next = 13;
                break;

              case 12:
                _context6.t0 = 0;

              case 13:
                txCount = _context6.t0;

              case 14:
                _context6.next = 16;
                return this._web3.eth.getBlock('latest');

              case 16:
                _context6.t1 = _context6.sent.timestamp;
                _context6.t2 = timeLimit;
                beforeTime = _context6.t1 + _context6.t2;
                txData = this._web3.eth.abi.encodeParameters(['address', 'bytes', 'uint256', 'address', 'uint256', 'uint256'], [to, data, value, feeToken, feeValue, beforeTime]);
                _context6.next = 22;
                return this.sign(wallet.primaryAddress, this._web3.utils.soliditySha3(wallet.secondaryAddress, txData, txCount));

              case 22:
                txSignature = _context6.sent;
                return _context6.abrupt("return", {
                  primaryAddress: wallet.primaryAddress,
                  from: wallet.secondaryAddress,
                  txData: txData,
                  txSignature: txSignature
                });

              case 24:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function signQuickTransaction(_x6) {
        return _signQuickTransaction.apply(this, arguments);
      }

      return signQuickTransaction;
    }()
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
    value: function sign(primaryAddr, data) {
      var wallet = this.wallets.find(function (_ref8) {
        var primaryAddress = _ref8.primaryAddress;
        return primaryAddress === primaryAddr;
      });

      if (!wallet) {
        throw new Error('Invalid address');
      }

      ;
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
     * @return String Address of the signer
     */

  }, {
    key: "recover",
    value: function recover(message, signature) {
      return _ethSigUtil["default"].recoverPersonalSignature({
        data: message,
        sig: signature
      });
    }
    /**
    * Deterministically computes the smart contract address
    *
    * @param String deployerAddress The address of the creator contract
    * @param String saltHex The salt to be used in hex format
    * @param String byteCode The bytecode of the smart contract to create
    */

  }, {
    key: "buildCreate2Address",
    value: function buildCreate2Address(deployerAddress, saltHex, byteCode) {
      return this._web3.utils.toChecksumAddress("0x".concat(this._web3.utils.sha3("0x".concat(['ff', deployerAddress, saltHex, this._web3.utils.soliditySha3(byteCode)].map(function (x) {
        return x.replace(/0x/, '');
      }).join(''))).slice(-40)));
    }
  }, {
    key: "_deriveNewKeys",

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
    value: function _deriveNewKeys(num) {
      for (var i = num; i > 0; i--) {
        var wallet = this._root.deriveChild(this.wallets.length).getWallet();

        var primaryAddress = addHexPrefix(wallet.getAddress().toString('hex'));
        wallet.primaryAddress = primaryAddress;
        wallet.secondaryAddress = this.buildCreate2Address(this._walletFactory.address, this._web3.utils.soliditySha3(primaryAddress), _QuickWallet.bytecode + this._web3.eth.abi.encodeParameters(['address'], [primaryAddress]).substring(2));
        this.wallets.push(wallet);
      }

      ;
      return this.wallets.slice(-num);
    }
  }]);

  return QuickWallet;
}();

exports["default"] = QuickWallet;