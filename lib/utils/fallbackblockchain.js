var BlockchainDouble = require("../blockchain_double.js");
var VM = require("ethereumjs-vm");
var Account = require("ethereumjs-account");
var Block = require("ethereumjs-block");
var Log = require("./log.js");
var utils = require("ethereumjs-util");
var FallbackStorageTrie = require("./fallbackstoragetrie.js");
var Web3 = require("web3");
var to = require("./to.js");
var async = require("async");

var inherits = require("util").inherits;

inherits(FallbackBlockchain, BlockchainDouble);

function FallbackBlockchain(options) {
  var self = this;

  options = options || {};

  if (options.fallback == null) {
    throw new Error("FallbackBlockchain must be passed a fallback provider.");
  }

  this.fallback = options.fallback;
  this.fallback_block_number = options.fallback_block_number;

  if (typeof this.fallback == "string") {
    this.fallback = new Web3.providers.HttpProvider(this.fallback);
  }

  options.trie = new FallbackStorageTrie(null, null, {
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number,
    blockchain: this
  });

  BlockchainDouble.call(this, options);

  // Unfortunately this requires a bit of monkey patching, but it gets the job done.
  //this.vm.stateManager._getStorageTrie = this.lookupStorageTrie.bind(this);
  this.vm.stateManager._lookupStorageTrie = this.lookupStorageTrie.bind(this);
  this.vm.stateManager.cache._lookupAccount = this.getAccount.bind(this);
  this.vm.stateManager.getContractCode = this.getCode.bind(this);
  this.vm.stateManager.putContractCode = this.putCode.bind(this);

  this.web3 = new Web3(this.fallback);
};

FallbackBlockchain.prototype.initialize = function(accounts, callback) {
  var self = this;

  var blockNumber = this.fallback_block_number || "latest";

  this.web3.eth.getBlock(blockNumber, function(err, json) {
    if (err) return callback(err);

    var block = self.createBlock();
    block.header.parentHash = utils.toBuffer(json.hash);

    // Update the relevant block numbers
    self.fallback_block_number = to.hex(json.number);
    self.stateTrie.fallback_block_number = to.hex(json.number);

    BlockchainDouble.prototype.initialize.call(self, accounts, block, callback);
  });
};

FallbackBlockchain.prototype.createFallbackStorageTrie = function(address) {
  address = to.hex(address);

  var trie = new FallbackStorageTrie(null, null, {
    address: address,
    stateTrie: this.stateTrie,
    blockchain: this,
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number
  });

  this.storageTrieCache[address] = trie;

  return trie;
};

FallbackBlockchain.prototype.lookupStorageTrie = function(address, callback) {
  var self = this

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

  this.stateTrie.keyExists(utils.toBuffer(address), function(err, accountExists) {
    if (err) return callback(err);

    self.stateTrie.get(utils.toBuffer(address), function(err, data) {
      if (err) return callback(err);
      var account = new Account(data);
      callback(null, accountExists, account);
    })
  })
};

FallbackBlockchain.prototype.getBlock = function(number, callback) {
  var self = this;

  function isBlockHash(value) {
    return typeof value == "string" && value.indexOf("0x") == 0 && value.length > 42;
  }

  function isFallbackBlockHash(value) {
    return isBlockHash(value) && self.blockHashes[value] == null;
  }

  function isFallbackBlock(value) {
    value = self.getEffectiveBlockNumber(value);
    return value <= to.number(self.fallback_block_number);
  }

  function getFallbackBlock(number_or_hash, cb) {
    self.web3.eth.getBlock(number_or_hash, function(err, json) {
      if (err) return cb(err);

      if (json == null) return cb();

      var block = new Block();

      block.header.parentHash = utils.toBuffer(json.parentHash);
      block.header.uncleHash = utils.toBuffer(json.sha3Uncles);
      block.header.coinbase = utils.toBuffer(json.miner);
      block.header.stateRoot = utils.toBuffer(json.stateRoot); // Should we include the following three?
      block.header.transactionTrie = utils.toBuffer(json.transactionsRoot);
      block.header.receiptTrie = utils.toBuffer(json.receiptRoot);
      block.header.bloom = utils.toBuffer(json.logsBloom);
      block.header.difficulty = utils.toBuffer("0x" + json.totalDifficulty.toString(16)); // BigNumber
      block.header.number = utils.toBuffer(json.number);
      block.header.gasLimit = utils.toBuffer(json.gasLimit);
      block.header.gasUsed = utils.toBuffer(json.gasUsed);
      block.header.timestamp = utils.toBuffer(json.timestamp);
      block.header.extraData = utils.toBuffer(json.extraData);

      // Fake block. Let's do the worst.
      // TODO: Attempt to fill out all block data so as to produce the same hash! (can we?)
      block.hash = function() {
        return utils.toBuffer(json.hash);
      }

      cb(null, block);
    });
  }

  if (isFallbackBlockHash(number) || isFallbackBlock(number)) {
    return getFallbackBlock(number, callback);
  } else {
    if (!isBlockHash(number)) {
      number = this.getRelativeBlockNumber(number);
    }
    return BlockchainDouble.prototype.getBlock.call(this, number, callback);
  }
};

FallbackBlockchain.prototype.getStorage = function(address, key, number, callback) {
  this.lookupStorageTrie(address, function(err, trie) {
    if (err) return callback(err);
    trie.get(key, callback);
  });
};

FallbackBlockchain.prototype.getCode = function(address, number, callback) {
  var self = this;

  if (typeof number == "function") {
    callback = number;
    number = this.getEffectiveBlockNumber("latest");
  }

  if (!number) {
    number = this.getEffectiveBlockNumber("latest");
  }

  number = this.getEffectiveBlockNumber(number);

  this.addressExists(address, function(err, exists, account) {
    if (exists && number > to.number(self.fallback_block_number)) {
      BlockchainDouble.prototype.getCode.call(self, address, number, callback);
    } else {

      if (number > to.number(self.fallback_block_number)) {
        number = "latest";
      }

      self.fetchCodeFromFallback(address, number, function(err, code) {
        if (code) {
          code = utils.toBuffer(code);
        }
        callback(err, code);
      });
    }
  });
};

FallbackBlockchain.prototype.putCode = function(address, value, callback) {
  // This is a bit of a hack. We need to bypass the vm's
  // _lookupAccount call that vm.stateManager.putContractCode() uses.
  // This means we have to do somethings ourself. The last call
  // to self.stateTrie.put() at the bottom is important because
  // we can't just be satisfied putting it in the cache.

  var self = this;
  address = utils.toBuffer(address);
  this.stateTrie.get(address, function(err, data) {
    if (err) return callback(err);

    var account = new Account(data);
    account.setCode(self.stateTrie, value, function(err, result) {
      if (err) return callback(err);

      self.stateTrie.put(address, account.serialize(), function(err) {
        if (err) return callback(err);

        // Ensure the cache updates as well.
        self.vm.stateManager._putAccount(address, account, callback);
      });
    });
  })
};

FallbackBlockchain.prototype.getAccount = function(address, number, callback) {
  var self = this;

  if (typeof number == "function") {
    callback = number;
    number = "latest";
  }

  // If the account doesn't exist in our state trie, get it off the wire.
  this.addressExists(address, function(err, exists, account) {
    if (err) return callback(err);

    if (exists && self.getEffectiveBlockNumber(number) > to.number(self.fallback_block_number)) {
      BlockchainDouble.prototype.getAccount.call(self, address, number, function(err, acc) {
        if (err) return callback(err);
        callback(null, acc);
      });
    } else {
      self.fetchAccountFromFallback(address, number, callback);
    }
  });
};

FallbackBlockchain.prototype.fetchAccountFromFallback = function(address, block_number, callback) {
  var self = this;
  address = to.hex(address);

  async.parallel({
    code: this.fetchCodeFromFallback.bind(this, address, block_number),
    balance: this.fetchBalanceFromFallback.bind(this, address, block_number),
    nonce: this.fetchNonceFromFallback.bind(this, address, block_number)
  }, function(err, results) {
    if (err) return callback(err);

    var code = results.code;
    var balance = results.balance;
    var nonce = results.nonce;

    var account = new Account({
      nonce: nonce,
      balance: balance
    });

    account.exists = code != "0x0" || balance != "0x0" || nonce != "0x0";

    // This puts the code on the trie, keyed by the hash of the code.
    // It does not actually link an account to code in the trie.
    account.setCode(self.stateTrie, utils.toBuffer(code), function(err) {
      if (err) return callback(err);
      callback(null, account);
    });
  });
};

FallbackBlockchain.prototype.fetchCodeFromFallback = function(address, block_number, callback) {
  var self = this;
  address = to.hex(address);

  // Allow an optional block_number
  if (typeof block_number == "function") {
    callback = block_number;
    block_number = this.fallback_block_number;
  }

  block_number = this.getSafeFallbackBlockNumber(block_number);

  this.web3.eth.getCode(address, block_number, function(err, code) {
    if (err) return callback(err);

    code = "0x" + self.web3.toBigNumber(code).toString(16);
    callback(null, code);
  });
}

FallbackBlockchain.prototype.fetchBalanceFromFallback = function(address, block_number, callback) {
  var self = this;
  address = to.hex(address);

  // Allow an optional block_number
  if (typeof block_number == "function") {
    callback = block_number;
    block_number = this.fallback_block_number;
  }

  block_number = this.getSafeFallbackBlockNumber(block_number);

  this.web3.eth.getBalance(address, block_number, function(err, balance) {
    if (err) return callback(err);

    balance = "0x" + balance.toString(16); // BigNumber
    callback(null, balance);
  });
}

FallbackBlockchain.prototype.fetchNonceFromFallback = function(address, block_number, callback) {
  var self = this;
  address = to.hex(address);

  // Allow an optional block_number
  if (typeof block_number == "function") {
    callback = block_number;
    block_number = this.fallback_block_number;
  }

  block_number = this.getSafeFallbackBlockNumber(block_number);

  this.web3.eth.getTransactionCount(address, block_number, function(err, nonce) {
    if (err) return callback(err);

    nonce = "0x" + self.web3.toBigNumber(nonce).toString(16);
    callback(null, nonce);
  });
}

FallbackBlockchain.prototype.getHeight = function() {
  return to.number(this.fallback_block_number) + this.blocks.length;
};

FallbackBlockchain.prototype.getRelativeBlockNumber = function(number) {
  number = this.getEffectiveBlockNumber(number);
  return number - to.number(this.fallback_block_number) - 1;
};

FallbackBlockchain.prototype.getSafeFallbackBlockNumber = function(block_number) {
  var fallback_block_number = to.number(this.fallback_block_number);

  if (block_number == null) return fallback_block_number;

  var number = this.getEffectiveBlockNumber(block_number);

  if (number > fallback_block_number) {
    number = fallback_block_number
  }

  return number;
};

FallbackBlockchain.prototype.getBlockLogs = function(number, callback) {
  number = this.getEffectiveBlockNumber(number);
  var relative = this.getRelativeBlockNumber(number);

  if (relative < 0) {
    this.web3.currentProvider.sendAsync({
      jsonrpc: "2.0",
      method: "eth_getLogs",
      params: [{
        fromBlock: to.hex(number),
        toBlock: to.hex(number)
      }],
      id: new Date().getTime()
    }, function(err, res) {
      if (err) return callback(err);

      var logs = res.result.map(function(log) {
        return new Log(log);
      });

      callback(null, logs);
    });
  } else {
    BlockchainDouble.prototype.getBlockLogs.call(this, relative, callback);
  }
};

FallbackBlockchain.prototype.snapshot = function(callback) {
  var self = this;

  BlockchainDouble.prototype.snapshot.call(this, function(err) {
    if (err) return callback(err);

    Object.keys(self.storageTrieCache).forEach(function(address) {
      var trie = self.storageTrieCache[address];
      trie.customCheckpoint();
    });

    callback();
  });
};

FallbackBlockchain.prototype.revert = function(number, callback) {
  var self = this;
  number = this.getRelativeBlockNumber(number);

  BlockchainDouble.prototype.revert.call(this, number, function(err) {
   if (err) return callback(err);

    Object.keys(self.storageTrieCache).forEach(function(address) {
      var trie = self.storageTrieCache[address];

      // We're trying to revert to a point before this trie was created.
      // Let's just remove the trie.
      if (trie.checkpoints.length == 0) {
        delete self.storageTrieCache[address];
      } else {
        trie.customRevert();
      }
    });

    callback();
  });
};

module.exports = FallbackBlockchain;
