var EtherSim = require('./lib/main.js');
var web3 = require('web3');

var Manager = EtherSim.Manager;
var Provider = EtherSim.Provider;

console.log("initializing");
var manager = new Manager();

web3.setProvider(new Provider(manager));

console.log(web3.eth.accounts);
console.log("ready");

var greeterSource = 'contract mortal { address owner; function mortal() { owner = msg.sender; } function kill() { if (msg.sender == owner) suicide(owner); } } contract greeter is mortal { string greeting; function greeter(string _greeting) public { greeting = _greeting; } function greet() constant returns (string) { return greeting; } }';

var greeterCompiled = web3.eth.compile.solidity(greeterSource);

var _greeting = "Hello World!";
var greeterContract = web3.eth.contract(greeterCompiled.greeter.info.abiDefinition);

var greeter = greeterContract.new(_greeting,{from:web3.eth.accounts[0], data: greeterCompiled.greeter.code, gas: 300000}); //, function(e, contract){
//    console.log(arguments);
//    if(!e) {
//
//      if(!contract.address) {
//        console.log("Contract transaction send: TransactionHash: " + contract.transactionHash + " waiting to be mined...");
//
//      } else {
//        console.log("Contract mined! Address: " + contract.address);
//        console.log(contract);
//      }
//
//    }
//});

console.log("||||||||||");
console.log(greeter.transactionHash);
console.log("||||||||||");

console.log("||||||||||");
receipt = web3.eth.getTransactionReceipt(greeter.transactionHash);
console.log(receipt.contractAddress);
console.log("||||||||||");

//console.log(web3.eth.getBlock(0));
