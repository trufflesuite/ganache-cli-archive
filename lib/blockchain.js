var Account = require('./account.js');
var Block = require('./block.js');
var VM = require('ethereumjs-vm');
var Trie = require('merkle-patricia-tree');
var Transaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');

Blockchain = function() {
  this.stateTrie = new Trie();
  this.vm = new VM(this.stateTrie);
  this.nonce = 0;
  this.blockNumber = 1;
  this.accounts = [];
  this.blocks = [];
  this.blockNum = 0;
  this.time = Date.now();
  this.contracts = {};
  this.blockHashes = {};
  this.transactions = {};
}

Blockchain.prototype.addAccount = function(_params) {
  var account = new Account(_params);
  this.stateTrie.put(account._address, account.serialize(), function() {});
  this.accounts.push(account);
  this.lastBlockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
}

Blockchain.prototype.accountAddresses = function() {
  var addresses = [];
  for(var i=0; i<this.accounts.length; i++) {
    addresses.push(utils.addHexPrefix(this.accounts[i].address));
  }
  return addresses;
}

Blockchain.prototype.addBlock = function() {
  this.blockNumber += 1;
  var block = new Block(this, this.blockNumber, this.lastBlockHash, this.time);
  this.blocks.push(block);
  this.blockHashes[block.hash()] = block;
  this.lastBlockHash = block.hash;
}

Blockchain.prototype.latestBlock = function() {
  return this.blocks[this.blocks.length - 1];
}

Blockchain.prototype.gasPrice = function() {
  return '09184e72a000';
}

Blockchain.prototype.balanceOf = function(_address) {
  var address = utils.addHexPrefix(_address);
  var account = this.accounts.filter(function(a) { return utils.addHexPrefix(a.address) == address })[0];
  if (account === undefined) {
    return '0';
  }
  else {
    return account.balance();
  }
}

Blockchain.prototype.getCode = function(_address) {
  var address = utils.addHexPrefix(_address);
  return this.contracts[address] || "";
}

Blockchain.prototype.getBlockByNumber = function(_number) {
  var number = eval(_number);
  return this.blocks[number].toJSON() || null;
}

Blockchain.prototype.getBlockByHash = function(_hash) {
  return this.blockHashes[_hash].toJSON() || null;
}

Blockchain.prototype.getReceipt = function(_hash) {
  var transactionHash = this.transactions[_hash];

  if (transactionHash !== undefined) {
    return transactionHash.receipt;
  }
  else {
    return null;
  }
}

module.exports = Blockchain;
