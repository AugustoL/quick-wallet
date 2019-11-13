const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545', undefined, { transactionConfirmationBlocks: 1 });
const fs = require('fs');

const QuickWalletFactory = require("../../smart-contracts/build/contracts/QuickWalletFactory.json");
const QuickWallet = require("../../smart-contracts/build/contracts/QuickWallet.json");
const UniswapExchangeFactory = require("../smart-contracts/UniswapExchangeFactory.json");
const UniswapExchange = require("../smart-contracts/UniswapExchange.json");
const ERC20Mock = require("../smart-contracts/ERC20Mock.json");

web3.eth.getAccounts().then( (accounts) => {

  function deployContract(contractJson, constructorParameters = []) {
    const contract = new web3.eth.Contract(contractJson.abi);
    return contract.deploy({
      data: contractJson.bytecode,
      arguments : constructorParameters
    }).send({from: accounts[0], gasPrice: 1, gasLimit: 4700000});
  }

  let token, uniswapFactory, uniswapExchangeTemplate, uniswapExchange, quickWalletFactory;

  deployContract(QuickWalletFactory, [QuickWallet.bytecode])
    .then((_quickWalletFactory) => {
      quickWalletFactory = _quickWalletFactory;
      console.log('QuickWallet factory deployed on', quickWalletFactory._address);
      return deployContract(ERC20Mock, [accounts[0], web3.utils.toWei("2000")])

    }).then((ERC20Mock) => {

      console.log('ERC20 Token deployed on', ERC20Mock._address);
      token = ERC20Mock;
      return deployContract(UniswapExchange);

    }).then((_uniswapExchangeTemplate) => {

      uniswapExchangeTemplate = _uniswapExchangeTemplate;
      return deployContract(UniswapExchangeFactory);

    }).then((_uniswapFactory) => {

      console.log('Uniswap Factory deployed on', _uniswapFactory._address);
      uniswapFactory = _uniswapFactory;
      return uniswapFactory.methods.initializeFactory(uniswapExchangeTemplate._address)
        .send({from: accounts[0], gasPrice: 1, gasLimit: 4700000});

    }).then((uniswapFactoryInitialized) => {

      return uniswapFactory.methods.createExchange(token._address)
        .send({from: accounts[0], gasPrice: 1, gasLimit: 4700000});

    }).then((uniswapExchangeDeployed) => {

      uniswapExchange = new web3.eth.Contract(UniswapExchange.abi, uniswapExchangeDeployed.events.NewExchange.returnValues.exchange);
      console.log('Uniswap Exchange deployed on', uniswapExchange._address);
      return token.methods.approve(uniswapExchange._address, web3.utils.toWei("1000")).send({from: accounts[0]})

    }).then((tokensApproved) => {

      console.log('1000 Tokens approved to exchange contract')
      const deadline = Math.round((new Date().getTime() / 1000) + 10);
      return uniswapExchange.methods.addLiquidity("0",  web3.utils.toWei("1"), deadline.toString())
        .send({from: accounts[0], gasPrice: 1, value: web3.utils.toWei("10"), gasLimit: 4700000})

    }).then((uniswapExchangeFunded) => {
      console.log('Exchange funded');
      fs.writeFileSync(process.env.PWD+'/.config-dev.json',
        JSON.stringify({
          quickWalletFactory: quickWalletFactory._address,
          uniswapFactory: uniswapFactory._address,
          token: token._address,
          uniswapExchanges: [{
            token: token._address,
            address: uniswapExchange._address
          }],
          minimunETHWeiProfit: '100000',
          port: '3000'
        }, null, "  ")
      );
    });

});
