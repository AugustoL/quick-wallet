# Quick Wallet

A smart contract wallet focused on usability and anonymity.

- Generate and access your wallet from a master private key.
- Create as many wallets as you want.
- No need to hold ETH to create wallets and send transactions.
- Pay transaction and creation fees in ERC20 tokens.

# QuickWallet JS Stack

This monorepo will cover all the tools that a user or company needs in order to integrate the quickwallet in their dapps or system. It provides the solidity smart contracts, a javascript library and a nodejs relayer node.
Each part of the stack is designed to be light (not too much code, easier to test and setup) and flexible (allow ANY call execution, transfer of data and value to ANY address).

## Delegate transaction execution
Quick wallets uses BIP44 to create smart contract wallets from contract factory. The smart contract wallet is a very simple contract that allows only the execution of calls signed by the wallet owner, the execution and ETH fees for this calls can be covered by transaction relayers, this relayers take a small fee for this.

## Dynamic Fees
The owner can create multiple signatures for the same transaction with different fees. If Bob wants to send 100 tokens to Alice he can push to the relayer three signatures, one to pay 3 tokens if the transfer is executed in 10 seconds, 2 tokens if its executed in 20 seconds and 1 token if its executed after that. This transactions cant be executed twice since the wallet logic protects it against double spend.

## An step closer towards anonymity
There is no cost in generating a new address in your wallet, and its completely unrelated to the rest of your addresses. The only missing piece in the puzzle is how this new address is funded? The wallet is created when it is used to send the first transaction, but it has to have ETH or tokens first. To fully protect the identity the wallet owner needs to be careful from where the funding transaction comes from.
A potential solution to this is to use an ethereum mixer contract to fund new wallets.

# QuickWallet Structure

Master Private Key
  - Wallet 1
    - Keys
      - Public Key
      - Private Key
    - Primary Address
    - SecondaryAddress
  - Wallet 2
  - Wallet 3
...

The quickwallet address is precomputed by using the hashed primary address as salt, there in no danger in sharing the salt, since the quickwallet address that you will used is generated using the bytecode of the Wallet contract, and this contract only allows execution signed by the owner private key. Like any other wallet you only have to key your private keys safe.

Each QuickWallet generated has two addresses, the primary address, a common ETH address and the secondary address, which would be the QuickWallet address, that can be used to push transactions to the network, this transactions are executed by relayers and the fees can be payed in ERC20 tokens or ETH. You can also execute the transactions yourself and decide which address you want to use for the transaction execution and ETH fee payment.

# QuickWallet Transaction Structure

- QuickWallet TX data:
  - `receiver` The address of the contract to call.
  - `data` ABI-encoded contract call to execute.
  - `value` Amount of ETH in wei to be sent in the call.
  - `feeToken` The token used for the fee, use the wallet address for ETH.
  - `feeValue` The amount to be payed as fee in wei.
  - `beforeTime` timetstamp of the time limit for this TX to be executed.

The TX data is sent encoded to the QuickWallet contract, this can be done by using web3.eth.abi.encodeParameters.

- QuickWallet TX signature:
  - `address` The address of the wallet to be used.
  - `bytes` The encoded tx data.
  - `uint256` The tx count of the wallet also known as nonce or transaction count.

The message signed is a hash in keccak256 of the three variables showed above, wallet address, data and tx count.
