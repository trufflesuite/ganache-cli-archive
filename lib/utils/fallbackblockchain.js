var BlockchainDouble = require("../blockchain_double.js");
var VM = require("ethereumjs-vm");
var Account = require("ethereumjs-account");
var utils = require("ethereumjs-util");
var FallbackStorageTrie = require("./fallbackstoragetrie.js");
var Web3 = require("web3");
var to = require("./to.js");

var inherits = require("util").inherits;

inherits(FallbackBlockchain, BlockchainDouble);

function FallbackBlockchain(options) {
  options = options || {};

  if (options.fallback == null) {
    throw new Error("FallbackBlockchain must be passed a fallback provider.");
  }

  this.fallback = options.fallback;
  this.fallback_block_number = options.fallback_block_number;

  if (typeof this.fallback == "string") {
    this.fallback = new Web3.providers.HttpProvider(this.fallback);
  }

  options.trie = new FallbackStorageTrie({
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number,
    blockchain: this
  });

  options.vm = new VM(this.stateTrie, this, {
    enableHomestead: true,
    activatePrecompiles: true
  });

  BlockchainDouble.call(this, options);

  this.vm.stateManager._getStorageTrie = this.lookupStorageTrie.bind(this);
  this.vm.stateManager.cache._lookupAccount = this.getAccount.bind(this);
  this.vm.stateManager.getContractCode = this.getCode.bind(this);

  this.web3 = new Web3(this.fallback);
};

FallbackBlockchain.prototype.initialize = function(callback) {
  var self = this;

  if (this.fallback_block_number) {
    self.fallback_block_number = to.hex(self.fallback_block_number);
    self.stateTrie.fallback_block_number = self.fallback_block_number;
    BlockchainDouble.prototype.initialize.call(self, callback);
  } else {
    this.web3.eth.getBlockNumber(function(err, result) {
      if (err) return callback(new Error("Error requesting fallback provider: " + err.message));

      self.fallback_block_number = result;
      self.stateTrie.fallback_block_number = self.fallback_block_number;

      BlockchainDouble.prototype.initialize.call(self, callback);
    });
  }
};

FallbackBlockchain.prototype.createFallbackStorageTrie = function(address) {
  address = to.hex(address);

  var trie = new FallbackStorageTrie({
    address: address,
    stateTrie: this.stateTrie,
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number
  });

  this.storageTrieCache[address] = trie;

  return trie;
};

FallbackBlockchain.prototype.lookupStorageTrie = function(address, callback) {
  address = to.hex(address);

  if (this.storageTrieCache == null) {
    this.storageTrieCache = {};
  }

  if (this.storageTrieCache[address] != null) {
    return callback(null, this.storageTrieCache[address]);
  }

  callback(null, this.createFallbackStorageTrie(address));
};

FallbackBlockchain.prototype.addressExists = function(address, callback) {
  var self = this;

  this.stateTrie.get(utils.toBuffer(address), function(err, data) {
    if (err) return callback(err);

    var account = new Account(data);
    var json = account.toJSON(true);

    var accountExists = json.nonce != "0x" || json.balance != "0x" || json.codeHash != "0x" + utils.sha3().toString("hex");

    account.getCode(self.stateTrie, function(err, code) {
      if (err) return callback(err);

      code = "0x" + code.toString("hex");

      var codeExists = code != "0x" && code != "0x0";

      callback(null, accountExists || codeExists, account);
    });
  });
};

FallbackBlockchain.prototype.getStorage = function(address, key, number, callback) {
  this.lookupStorageTrie(address, function(err, trie) {
    if (err) return callback(err);
    trie.get(key, callback);
  });

  // var self = this;
  // this.addressExists(address, function(err, exists) {
  //   if (exists) {
  //     BlockchainDouble.prototype.getStorage.call(self, address, key, number, callback);
  //
  //     /
  //   } else {
  //     self.web3.eth.getCode(to.hex(address), callback);
  //   }
  // });
};

FallbackBlockchain.prototype.getCode = function(address, callback) {
  var self = this;
  this.addressExists(address, function(err, exists, account) {
    if (exists) {
      account.getCode(self.stateTrie, callback);
    } else {
      self.web3.eth.getCode(to.hex(address), function(err, code) {
        if (code) {
          code = utils.toBuffer(code);
        }
        callback(err, code);
      });
    }
  });
};

FallbackBlockchain.prototype.getAccount = function(address, callback) {
  var self = this;

  // If the account doesn't exist in our state trie, use get it off the wire.
  this.addressExists(address, function(err, exists, account) {
    if (err) return callback(err);

    if (exists) {
      return callback(null, account);
    } else {
      self.stateTrie.fetchAccount(address, callback);
    }
  });
};

module.exports = FallbackBlockchain;
