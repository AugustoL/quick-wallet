# Quick Wallet

A smart contract wallet focused on usability and anonymity.

- Generate and access your wallet from a master private key.
- Create as many wallets as you want.
- No need to hold ETH to create wallets and send transactions.
- Pay transaction and creation fees in ERC20 tokens.

## Delegate transaction execution
Quick wallets uses BIP44 to create smart contract wallets from contract factory. The smart contract wallet is a very simple contract that allows only the execution of calls signed by the wallet owner, the execution and ETH fees for this calls can be covered by transaction relayers, this relayers take a small fee for this.

## Dynamic Fees
The owner can create multiple signatures for the same transaction with different fees. If Bob wants to send 100 tokens to Alice he can push to the relayer three signatures, one to pay 3 tokens if the transfer is executed in 10 seconds, 2 tokens if its executed in 20 seconds and 1 token if its executed after that. This transactions cant be executed twice since the wallet logic protects it against double spend.

## An step closer towards anonymity
There is no cost in generating a new address in your wallet, and its completely unrelated to the rest of your addresses. The only missing piece in the puzzle is how this new address is funded? The wallet is create the first time this address is used to sent a transaction, but it has to have ETH or tokens first. To fully protect the identity the wallet owner needs to be careful from where the funding transaction come from.
A potential solution to this is to use an ethereum mixer contract to fund new wallets.
