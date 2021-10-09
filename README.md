# Flight Surety App

This app is to manage fligth insurance in case a registered flight from a participant airline is delayed due to airline responsability.

Once the airline is registered and funded, a flight can be added to the app, then a passenger can buy an insurance for that flight.


## Components

### Node / Truffle project.

The truffle config file is set for 2 diferent networks

1. Truffle development network

	- > truffle development
	- truffle > test
	- truffle > compile
	- truffle > migrate

2. Dapp for passengers to register a flight in the app for a participant airline and purchase the insurance. Also the passenger can check his / her balance as well as withdrawl funds from the Insurety App into his / her wallet.

	- > node run dapp

It starts listening in 3000 port.

3. Daemon app, to simulate Oracles in charge of listening for flight status request events as well as submit such status once their got it from the airport systems.

	- > node run daemon

## Development Appentix

1. Solidity v0.8.7 - programming language to develop Smart Contracts.
2. Openzeppelin v4.3.2 - to get some Math libraries
3. Truffle v5.4.13 - a development framework for Ethereum.
4. Moca v8.1.2 - for JUnit testing.
5. Ganache v2.5.4 - for integration testing.
6. lite-server v2.6.1 - for WebApp development.
7. web3.js v1.6.0 - JavaScript library for access Ethereum network from WebApp.
8. truffle-contract v4.3.37 - as Solidity compiled contract interface through the Web3Provider.



