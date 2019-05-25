pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Wallet is Ownable {

    using ECDSA for bytes32;

    // Used to prevent execution of already executed txs during a timeframe
    mapping(bytes32 => uint256) public pastTxs;

    /**
     * @dev Constructor
     * @param owner The address of the wallet owner
     */
    constructor(address owner) public {
        _transferOwnership(owner);
    }

    /**
     * @dev Call a external contract and pay a fee for the call
     * @param to The address of the contract to call
     * @param data ABI-encoded contract call to call `_to` address.
     * @param txSignature The signature of the wallet owner
     * @param feeToken The token used for the fee, use this wallet address for ETH
     * @param feeValue The amount to be payed as fee
     * @param beforeTime timetstamp of the time where this tx cant be executed
     * once it passed
     */
    function call(
        address to, bytes memory data, address feeToken,
        uint256 feeValue, uint256 beforeTime, bytes memory txSignature
    ) public payable {
        require(beforeTime > block.timestamp, "Invalid beforeTime value");

        bytes32 txHash = keccak256(txSignature);
        require(pastTxs[txHash] == 0, "TX replay rejected");

        address _signer = keccak256(abi.encodePacked(to, data, feeToken, feeValue, beforeTime))
            .toEthSignedMessageHash().recover(txSignature);
        require(owner() == _signer, "Signer is not wallet owner");

        bytes memory feePaymentData = abi.encodeWithSelector(
            bytes4(keccak256("transfer(address,uint256)")), msg.sender, feeValue
        );

        _call(to, data);
        _call(feeToken, feePaymentData);
        pastTxs[txHash] = now;
    }

    /**
     * @dev Call a external contract
     * @param to The address of the contract to call
     * @param data ABI-encoded contract call to call `_to` address.
     * @param txSignature The signature of the wallet owner
     * @param beforeTime timetstamp of the time where this tx cant be executed
     * once it passed
     */
    function call(
        address to, bytes memory data, uint256 beforeTime, bytes memory txSignature
    ) public payable {
        require(beforeTime > block.timestamp, "Invalid beforeTime value");

        bytes32 txHash = keccak256(txSignature);
        require(pastTxs[txHash] == 0, "TX replay rejected");

        address _signer = keccak256(abi.encodePacked(to, data, beforeTime))
            .toEthSignedMessageHash().recover(txSignature);
        require(owner() == _signer, "Signer is not wallet owner");

        _call(to, data);
        pastTxs[txHash] = now;
    }

    /**
     * @dev Transfer eth, can only be called from this contract
     * @param to The address to transfer the eth
     * @param value The amount of eth in wei to be transfered
     */
    function transfer(address payable to, uint256 value) public {
        require(msg.sender == address(this));
        to.transfer(value);
    }

    /**
     * @dev Call a external contract
     * @param _to The address of the contract to call
     * @param _data ABI-encoded contract call to call `_to` address.
     */
    function _call(address _to, bytes memory _data) internal {
        // solhint-disable-next-line avoid-call-value
        (bool success, bytes memory data) = _to.call.value(msg.value)(_data);
        require(success, "Call to external contract failed");
    }

}
