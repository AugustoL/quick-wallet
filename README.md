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
There is no cost in generating a new address in your wallet, and its completely unrelated to the rest of your addresses. The only missing piece in the puzzle is how this new address is funded? The wallet is created qhen is used to send teh first transaction, but it has to have ETH or tokens first. To fully protect the identity the wallet owner needs to be careful from where the funding transaction comes from.
A potential solution to this is to use an ethereum mixer contract to fund new wallets.

# Wallet Structure

Master Private Key
  - Wallet 1
    - Keys
      - Public Key
      - Private Key
    - Owner Address
    - QuickWallet Address
  - Wallet 2
  - Wallet 3
...

The quickwallet address is precomputed by using the hashed owner address as salt, there in no danger in sharing the salt, since the quickwallet address that you will used is generated using the bytecode of the Wallet contract, and this contract only allows execution signed by the owner private key. Like any other wallet you only have to key your private keys safe.

Each QuickWallet generated has two addresses, the owner, a common ETH address and the QuickWallet address, that can be used to push transactions to the network, this transactions are executed by relayers and the fees can be payed in ERC20 tokens or ETH. You can also execute the transactions yourself and decide which address you want to use for the transaction execution and ETH fee payment.
