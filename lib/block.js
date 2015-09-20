var Transaction = require('./transaction.js');
var crypto = require('crypto');
var utils = require('ethereumjs-util');

Block = function(currentChain, blockNumber, currentHash, currentTime) {
  this.blockchain = currentChain;
  this.number = blockNumber;

  this._hash = '0x' + crypto.randomBytes(64).toString('hex');

  this.parentHash = currentHash;
  this.timestamp = currentTime;
  this.transactions = [];
}

Block.prototype.toJSON = function() {
  block = {
    "number": '0x' + utils.intToHex(this.number),
    "hash": this.hash(),
    "parentHash": this.parentHash,
    "nonce":"0x4332a3d2ad553d23",
    "sha3Uncles":"0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
    "logsBloom":"0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
    "transactionsRoot":"0x5409c6eef38ff27507a14cb27da502b144f19eddbf67e890fabd9db244f4b217",
    "stateRoot":"0xc5b7816d17bdd2e409375408b54be42fa690c7f1b6c9d94bce2debf01faa93ed",
    "miner":"0x8c302937c90d1a68253de03c1398595009381eb3",
    "difficulty":"0x4100d",
    "totalDifficulty":"0xcdc434",
    "size":"0x38a",
    "extraData":"0x476574682f76312e302e322f64617277696e2f676f312e35",
    "gasLimit":"0x48be49",
    "gasUsed":"0x16fe5",
    "timestamp": '0x' + utils.intToHex(this.timestamp),
    "transactions": this.transactionsHashes(),
    "uncles":[]
  }

  return block;
}

Block.prototype.transactionsHashes = function() {
  var hashes = [];
  for(var i=0; i<this.transactions.length; i++) {
    hashes.push(this.transactions[i].hash);
  }
  return hashes;
}

Block.prototype.runTransaction = function(params, cb) {
  var transaction = new Transaction(params);
  this.transactions.push(transaction);
  transaction.run(this, cb());
}

Block.prototype.hash = function() {
  return this._hash;
}

module.exports = Block;

