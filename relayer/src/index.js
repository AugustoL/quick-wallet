const express = require('express');
const asyncHandler = require('express-async-handler')
const Web3 = require('web3');
const bodyParser = require('body-parser')
const fs = require('fs');
const app = express();
const args = process.argv;
const mnemonic = fs.readFileSync('.mnemonic', 'utf8').replace(/(\r\n|\n|\r)/gm, "");
const zeroAddress = '0x0000000000000000000000000000000000000000';
app.use(bodyParser.json());

const UniswapExchange = require("../smart-contracts/UniswapExchange.json");
const ERC20Mock = require("../smart-contracts/ERC20Mock.json");

const QuickWallet = require("../../js-lib/dist/index.js");

let config, web3Provider;
for (var i = 0; i < args.length; i++) {
  if (args[i] == "--config")
    config = require(args[i+1]);
  if (args[i] == "--web3Provider")
    web3Provider = args[i+1];
}
const port = config.port;
const web3 = new Web3(web3Provider, undefined, { transactionConfirmationBlocks: 1 });
const quickWallet = QuickWallet.default.fromMnemonic(mnemonic , config.quickWalletFactory);
quickWallet.generateAddresses(2);
const quickWallets = quickWallet.getQuickWallets();
const relayerWallet = quickWallets[1].owner;

console.log('Config', config);
console.log('Web3 Provider', web3Provider);

const getUniswapExchangeInfo = async function(exchangeAddress) {
  const uniswapExchange = new web3.eth.Contract(UniswapExchange.abi, exchangeAddress);
  const token = new web3.eth.Contract(ERC20Mock.abi, (await uniswapExchange.methods.tokenAddress().call()));
  return {
    tokenAddress: token.address,
    name: web3.utils.hexToUtf8((await uniswapExchange.methods.name().call())),
    symbol: web3.utils.hexToUtf8((await uniswapExchange.methods.symbol().call())),
    decimals: web3.utils.hexToNumberString((await uniswapExchange.methods.decimals().call())._hex),
    tokenBalance: web3.utils.hexToNumberString((await token.methods.balanceOf(uniswapExchange.address).call())._hex),
    ethBlance: await web3.eth.getBalance(uniswapExchange.address),
    // EthToTokenInputPrice: web3.utils.hexToNumberString((await uniswapExchange.methods.getEthToTokenInputPrice(web3.utils.toWei('1')).call())._hex),
    // EthToTokenOutputPrice: web3.utils.hexToNumberString((await uniswapExchange.methods.getEthToTokenOutputPrice(web3.utils.toWei('1')).call())._hex),
    // TokenToEthInputPrice: web3.utils.hexToNumberString((await uniswapExchange.methods.getTokenToEthInputPrice(web3.utils.toWei('1')).call())._hex),
    // TokenToEthOutputPrice: web3.utils.hexToNumberString((await uniswapExchange.methods.getTokenToEthOutputPrice(1).call())._hex)
  };
}

const calculateProfit = async function(weiCost, from, txData) {
  if (from === txData.feeToken) {
    return txData.feeValue - weiCost;
  } else {
    const exchange = config.uniswapExchanges.filter((e) => e.token == txData.feeToken);
    const uniswapExchange = new web3.eth.Contract(UniswapExchange.abi, exchange[0].address);
    const weiETHReturn = await uniswapExchange.methods.getTokenToEthInputPrice(txData.feeValue.toString()).call();
    return weiETHReturn - weiCost;
  }
};

app.get('/', asyncHandler(async (req, res, next) => {
    res.json(config);
}));

app.get('/exchange/:address', asyncHandler(async (req, res, next) => {
  res.json(await getUniswapExchangeInfo(req.params.address));
}));

app.post('/', asyncHandler(async (req, res, next) => {
  const relayWeiETHCost = await quickWallet.estimateRelayCost({from: relayerWallet, quickTransaction: req.body});
  const txData = web3.eth.abi.decodeParameters(
    [{name: 'to', type: 'address'},
    {name: 'data', type: 'bytes'},
    {name: 'feeToken', type: 'address'},
    {name: 'feeValue', type: 'uint256'},
    {name: 'beforeTime', type: 'uint256'}],
    req.body.txData
  );
  const weiETHProfit = await calculateProfit(relayWeiETHCost, req.body.from, txData);
  if (weiETHProfit >= config.minimunETHWeiProfit) {
    const tx = await quickWallet.relayTransaction({from: relayerWallet, quickTransaction: req.body, gasPrice: 1});
    res.send({
      "tx": tx,
      "relayWeiETHCost": relayWeiETHCost,
      "weiETHProfit": weiETHProfit
    });
  } else {
    res.send({
      "tx": "",
      "relayWeiETHCost": relayWeiETHCost,
      "weiETHProfit": weiETHProfit
    });
  }
}));

const server = app.listen(port, () => console.log(`QuickWallet tx relayer listening on port ${port}!`))

setInterval(() => server.getConnections(
    (err, connections) => {}
), 1000);

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
    server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
    });
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}
