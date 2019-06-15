"use strict";

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

var express = require('express');

var asyncHandler = require('express-async-handler');

var Web3 = require('web3');

var bodyParser = require('body-parser');

var app = express();
var port = 3000;
var args = process.argv;
app.use(bodyParser.json());

var UniswapExchange = require("../smart-contracts/UniswapExchange.json");

var ERC20Mock = require("../smart-contracts/ERC20Mock.json");

var _require = require("../../js-lib/dist/index.js"),
    QuickWallet = _require.QuickWallet;

var config, web3Provider;

for (var i = 0; i < args.length; i++) {
  if (args[i] == "--config") config = require(args[i + 1]);
  if (args[i] == "--web3Provider") web3Provider = args[i + 1];
}

console.log(QuickWallet);
var web3 = new Web3(web3Provider, undefined, {
  transactionConfirmationBlocks: 1
});
var quickWallet = QuickWallet.fromMnemonic("issue faculty stamp cherry teach blame help busy breeze enroll bacon junk", config.quickWalletFactory);
quickWallet.generateAddresses(2);
var quickWallets = quickWallet.getQuickWallets();
var relayerWallet = quickWallets[1].owner;
console.log('Config', config);
console.log('Web3 Provider', web3Provider);

var getUniswapExchangeInfo =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee(exchangeAddress) {
    var uniswapExchange, token;
    return regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            uniswapExchange = new web3.eth.Contract(UniswapExchange.abi, exchangeAddress);
            _context.t0 = web3.eth.Contract;
            _context.t1 = ERC20Mock.abi;
            _context.next = 5;
            return uniswapExchange.methods.tokenAddress().call();

          case 5:
            _context.t2 = _context.sent;
            token = new _context.t0(_context.t1, _context.t2);
            _context.t3 = token.address;
            _context.t4 = web3.utils;
            _context.next = 11;
            return uniswapExchange.methods.name().call();

          case 11:
            _context.t5 = _context.sent;
            _context.t6 = _context.t4.hexToUtf8.call(_context.t4, _context.t5);
            _context.t7 = web3.utils;
            _context.next = 16;
            return uniswapExchange.methods.symbol().call();

          case 16:
            _context.t8 = _context.sent;
            _context.t9 = _context.t7.hexToUtf8.call(_context.t7, _context.t8);
            _context.t10 = web3.utils;
            _context.next = 21;
            return uniswapExchange.methods.decimals().call();

          case 21:
            _context.t11 = _context.sent._hex;
            _context.t12 = _context.t10.hexToNumberString.call(_context.t10, _context.t11);
            _context.t13 = web3.utils;
            _context.next = 26;
            return token.methods.balanceOf(uniswapExchange.address).call();

          case 26:
            _context.t14 = _context.sent._hex;
            _context.t15 = _context.t13.hexToNumberString.call(_context.t13, _context.t14);
            _context.next = 30;
            return web3.eth.getBalance(uniswapExchange.address);

          case 30:
            _context.t16 = _context.sent;
            _context.t17 = web3.utils;
            _context.next = 34;
            return uniswapExchange.methods.getEthToTokenInputPrice(web3.utils.toWei('1')).call();

          case 34:
            _context.t18 = _context.sent._hex;
            _context.t19 = _context.t17.hexToNumberString.call(_context.t17, _context.t18);
            _context.t20 = web3.utils;
            _context.next = 39;
            return uniswapExchange.methods.getEthToTokenOutputPrice(web3.utils.toWei('1')).call();

          case 39:
            _context.t21 = _context.sent._hex;
            _context.t22 = _context.t20.hexToNumberString.call(_context.t20, _context.t21);
            _context.t23 = web3.utils;
            _context.next = 44;
            return uniswapExchange.methods.getTokenToEthInputPrice(web3.utils.toWei('1')).call();

          case 44:
            _context.t24 = _context.sent._hex;
            _context.t25 = _context.t23.hexToNumberString.call(_context.t23, _context.t24);
            _context.t26 = web3.utils;
            _context.next = 49;
            return uniswapExchange.methods.getTokenToEthOutputPrice(1).call();

          case 49:
            _context.t27 = _context.sent._hex;
            _context.t28 = _context.t26.hexToNumberString.call(_context.t26, _context.t27);
            return _context.abrupt("return", {
              tokenAddress: _context.t3,
              name: _context.t6,
              symbol: _context.t9,
              decimals: _context.t12,
              tokenBalance: _context.t15,
              ethBlance: _context.t16,
              EthToTokenInputPrice: _context.t19,
              EthToTokenOutputPrice: _context.t22,
              TokenToEthInputPrice: _context.t25,
              TokenToEthOutputPrice: _context.t28
            });

          case 52:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function getUniswapExchangeInfo(_x) {
    return _ref.apply(this, arguments);
  };
}();

var calculateProfit =
/*#__PURE__*/
function () {
  var _ref2 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee2(weiCost, weiTokenFee, tokenFee) {
    return regeneratorRuntime.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            _context2.next = 2;
            return getUniswapExchangeInfo(tokenFee);

          case 2:
            _context2.t0 = _context2.sent;
            _context2.t1 = weiTokenFee;
            _context2.t2 = _context2.t0 * _context2.t1;
            _context2.t3 = weiCost;
            return _context2.abrupt("return", _context2.t2 - _context2.t3);

          case 7:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));

  return function calculateProfit(_x2, _x3, _x4) {
    return _ref2.apply(this, arguments);
  };
}();

app.get('/', asyncHandler(
/*#__PURE__*/
function () {
  var _ref3 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee3(req, res, next) {
    var accounts;
    return regeneratorRuntime.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return web3.eth.getAccounts();

          case 2:
            accounts = _context3.sent;
            res.send(accounts);

          case 4:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));

  return function (_x5, _x6, _x7) {
    return _ref3.apply(this, arguments);
  };
}()));
app.get('/exchange', asyncHandler(
/*#__PURE__*/
function () {
  var _ref4 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee4(req, res, next) {
    return regeneratorRuntime.wrap(function _callee4$(_context4) {
      while (1) {
        switch (_context4.prev = _context4.next) {
          case 0:
            _context4.t0 = res;
            _context4.next = 3;
            return getUniswapExchangeInfo(config.uniswapExchanges[0]);

          case 3:
            _context4.t1 = _context4.sent;

            _context4.t0.send.call(_context4.t0, _context4.t1);

          case 5:
          case "end":
            return _context4.stop();
        }
      }
    }, _callee4);
  }));

  return function (_x8, _x9, _x10) {
    return _ref4.apply(this, arguments);
  };
}()));
app.post('/', asyncHandler(
/*#__PURE__*/
function () {
  var _ref5 = _asyncToGenerator(
  /*#__PURE__*/
  regeneratorRuntime.mark(function _callee5(req, res, next) {
    var relayCost;
    return regeneratorRuntime.wrap(function _callee5$(_context5) {
      while (1) {
        switch (_context5.prev = _context5.next) {
          case 0:
            console.log(req.body);
            _context5.next = 3;
            return quickWallet.estimateRelayCost({
              from: relayerWallet,
              quickTransaction: req.body
            });

          case 3:
            relayCost = _context5.sent;
            console.log(relayCost);
            res.send(relayCost);

          case 6:
          case "end":
            return _context5.stop();
        }
      }
    }, _callee5);
  }));

  return function (_x11, _x12, _x13) {
    return _ref5.apply(this, arguments);
  };
}()));
app.listen(port, function () {
  return console.log("Example app listening on port ".concat(port, "!"));
});