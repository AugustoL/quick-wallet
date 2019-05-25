pragma solidity ^0.5.0;

import "../utils/Create2.sol";
import "./Wallet.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "solidity-bytes-utils/contracts/BytesLib.sol";

contract WalletFactory {

    using BytesLib for bytes;

    bytes public baseContractCode;

    /**
     * @dev Constructor
     * @param _baseContractCode The base bytecode used for the wallet
     */
    constructor(bytes memory _baseContractCode) public {
        baseContractCode = _baseContractCode;
    }

    /**
     * @dev Deploy a Wallet contract and pay a fee
     * @param salt The hex salt used for the wallet creation
     * @param feeToken The token used for the fee, use this wallet address for ETH
     * @param feeValue The amount to be payed as fee
     * @param beforeTime timetstamp of the time where this tx cant be executed
     * once it passed
     * @param constructorData The ABI encoded data parameters for the costructor
     * @param feeSignature The signature of the fee payment
     */
    function deploy(
        bytes32 salt, address feeToken, uint256 feeValue, uint256 beforeTime,
        bytes memory constructorData, bytes memory feeSignature
    ) public {
        Wallet wallet = Wallet(_deploy(salt, constructorData));
        bytes memory feePaymentData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")), msg.sender, feeValue
        );
        wallet.call(feeToken, feePaymentData, beforeTime, feeSignature);
    }

    /**
     * @dev Deploy a Wallet contract
     * @param salt The hex salt used for the wallet creation
     * @param constructorData The ABI encoded data parameters for the costructor
     */
    function deploy(bytes32 salt, bytes memory constructorData) public {
        deploy(salt, constructorData);
    }

    /**
     * @dev Deploy a Wallet contract
     * @param _salt The hex salt used for the wallet creation
     * @param _constructorData The ABI encoded data parameters for the costructor
     */
    function _deploy(
        bytes32 _salt, bytes memory _constructorData
    ) internal returns (address) {
        bytes memory _code = baseContractCode.concat(_constructorData);
        return Create2.deploy(_salt, _code);
    }

}
