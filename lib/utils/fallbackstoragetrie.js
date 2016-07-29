var MerklePatriciaTree = require("merkle-patricia-tree");
var Account = require("ethereumjs-account");
var utils = require('ethereumjs-util')
var inherits = require("util").inherits;
var Web3 = require("web3");
var to = require("./to.js");


inherits(FallbackStorageTrie, MerklePatriciaTree)

function FallbackStorageTrie(options) {
  MerklePatriciaTree.call(this);

  this.address = options.address;
  this.stateTrie = options.stateTrie || this;

  this.fallback = options.fallback;
  this.fallback_block_number = options.fallback_block_number;

  this.web3 = new Web3();
  this.web3.setProvider(this.fallback);
}

FallbackStorageTrie.prototype.keyExists = function(key, callback) {
  key = utils.toBuffer(key);

  this._findPath(key, function (err, node, remainder, stack) {
    var exists = false;
    if (node && remainder.length === 0) {
      exists = true;
    }
    callback(err, exists)
  })
};

// Note: This overrides a standard method whereas the other methods do not.
FallbackStorageTrie.prototype.get = function(key, block_number, callback) {
  var self = this;

  // Allow an optional block_number
  if (typeof block_number == "function") {
    callback = block_number;
    block_number = self.fallback_block_number;
  }

  key = utils.toBuffer(key);

  // If the account doesn't exist in our state trie, get it off the wire.
  this.keyExists(key, function(err, exists) {
    if (err) return callback(err);

    if (exists) {
      MerklePatriciaTree.prototype.get.call(self, key, callback);
    } else {
      if (self.address == null) {
        self.fetchAccount(key, block_number, function(err, account) {
          if (err) return callback(err);

          callback(null, account.serialize());
        });
      } else {
        self.web3.eth.getStorageAt(to.hex(self.address), to.hex(key), block_number, function(err, value) {
          if (err) return callback(err);
          value = utils.toBuffer(value);
          callback(null, value);
          //value = utils.toBuffer(value);
          //value = utils.rlp.encode(value);
        });
      }
    }
  });
};

FallbackStorageTrie.prototype.fetchAccount = function(address, block_number, callback) {
  var self = this;
  var address = to.hex(address);

  // Allow an optional block_number
  if (typeof block_number == "function") {
    callback = block_number;
    block_number = this.fallback_block_number;
  }

  this.web3.eth.getCode(address, block_number, function(err, code) {
    if (err) return callback(new Error("Error communicating with fallback provider: " + err.message));

    self.web3.eth.getBalance(address, block_number, function(err, balance) {
      if (err) return callback(err);

      self.web3.eth.getTransactionCount(address, block_number, function(err, nonce) {
        if (err) return callback(err);

        balance = "0x" + balance.toString(16); // BigNumber
        nonce = "0x" + self.web3.toBigNumber(nonce).toString(16);
        code = "0x" + self.web3.toBigNumber(code).toString(16);

        var account = new Account({
          nonce: nonce,
          balance: balance
        });

        account.setCode(self.stateTrie, utils.toBuffer(code), function(err) {
          //if (err) return callback(err);
          callback(null, account);
        });
      });
    });
  });
};

module.exports = FallbackStorageTrie;
