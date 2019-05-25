
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

// returns true if contract is deployed on-chain
const isContract = async function (address) {
  const code = await web3.eth.getCode(address);
  return code.slice(2).length > 0;
};

module.exports = {
  buildCreate2Address,
  encodeParam,
  isContract,
};
