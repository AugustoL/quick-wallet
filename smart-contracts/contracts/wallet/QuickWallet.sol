pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/cryptography/ECDSA.sol";

contract QuickWallet {

    using ECDSA for bytes32;

    // Used to prevent execution of already executed txs
    uint256 public txCount;

    // QuickWallet owner address
    address public _owner;

    /**
     * @dev Constructor
     * @param owner The address of the wallet owner
     */
    constructor(address owner) public {
        _owner = owner;
    }

    /**
     * @dev Call a external contract and pay a fee for the call
     * @param receiver The address of the contract to call
     * @param data ABI-encoded contract call to call `_to` address.
     * @param feeToken The token used for the fee, use this wallet address for ETH
     * @param feeReceiver The receiver of the fee payment
     * @param feeValue The amount to be payed as fee
     * @param beforeTime timetstamp of the time where this tx cant be executed
     * once it passed
     * @param txSignature The signature of the wallet owner
     */
    function call(
        address receiver, bytes memory data, address feeToken, address feeReceiver,
        uint256 feeValue, uint256 beforeTime, bytes memory txSignature
    ) public payable {
        require(beforeTime > block.timestamp, "Invalid beforeTime value");
        require(feeToken != address(0), "Invalid fee token");

        address _signer = keccak256(abi.encodePacked(
            address(this), receiver, data, feeToken, feeValue, txCount, beforeTime
        )).toEthSignedMessageHash().recover(txSignature);
        require(owner() == _signer, "Signer is not wallet owner");

        _call(receiver, data);

        if (feeValue > 0) {
          bytes memory feePaymentData = abi.encodeWithSelector(
              bytes4(keccak256("transfer(address,uint256)")), feeReceiver, feeValue
          );
          _call(feeToken, feePaymentData);
        }

        txCount++;
    }

    /**
     * @dev Transfer eth, can only be called from this contract
     * @param receiver The address to transfer the eth
     * @param value The amount of eth in wei to be transfered
     */
    function transfer(address payable receiver, uint256 value) public {
        require(msg.sender == address(this));
        receiver.transfer(value);
    }

    /**
     * @dev Get QuickWallet owner address
     */
    function owner() public view returns (address) {
      return _owner;
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
