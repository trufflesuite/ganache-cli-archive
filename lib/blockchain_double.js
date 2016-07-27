var inherits = require("util").inherits;
var to = require("./utils/to.js");
var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var VM = require('ethereumjs-vm');
var Trie = require("merkle-patricia-tree");
var FallbackStorageTrie = require("./utils/fallbackstoragetrie.js");
var Web3 = require("web3");
var utils = require("ethereumjs-util");
var async = require('async');

function BlockchainDouble(options) {
  var self = this;

  options = options || {};

  this.logger = options.logger || console;

  this.fallback = options.fallback;
  this.fallback_block_number = options.fallback_block_number;

  this.stateTrie = new FallbackStorageTrie({
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number,
    blockchain: this
  });

  this.vm = new VM(this.stateTrie, this, {
    enableHomestead: true,
    activatePrecompiles: true
  });

  this.blocks = [];
  this.blockHashes = {};
  this.height = -1;
  this.pending_transactions = [];

  if (options.debug == true) {
    this.vm.on('step', function(info){
      self.logger.log(info.opcode.name)
    });
  }

  // Homestead Gas Limit is 4712388 / 0x47E7C4
  this.gasLimit = options.gasLimit || '0x47E7C4';

  if (this.fallback) {
    this.web3 = new Web3(new Web3.providers.HttpProvider(this.fallback));

    this.vm.stateManager._lookupStorageTrie = this.lookupStorageTrie.bind(this);
    this.vm.stateManager._getStorageTrie = this.lookupStorageTrie.bind(this);
    this.vm.stateManager.cache._lookupAccount = this.getAccount.bind(this);
  }

  // Create first block
  this.putBlock(this.createBlock());
};

BlockchainDouble.prototype.initialize = function(callback) {
  var self = this;

  if (this.fallback) {
    if (this.fallback_block_number) {
      self.fallback_block_number = to.hex(self.fallback_block_number);
      self.stateTrie.fallback_block_number = self.fallback_block_number;
      return callback();
    } else {
      this.web3.eth.getBlockNumber(function(err, result) {
        if (err) return callback(new Error("Error requesting fallback provider: " + err.message));

        self.fallback_block_number = result;
        self.stateTrie.fallback_block_number = self.fallback_block_number;

        callback();
      });
    }
  } else {
    callback();
  }
};

BlockchainDouble.prototype.createFallbackStorageTrie = function(address) {
  address = to.hex(address);

  var trie = new FallbackStorageTrie({
    address: address,
    stateTrie: this.stateTrie,
    blockchain: this,
    fallback: this.fallback,
    fallback_block_number: this.fallback_block_number
  });

  this.storageTrieCache[address] = trie;

  return trie;
};

BlockchainDouble.prototype.lookupStorageTrie = function(address, callback) {
  address = to.hex(address);

  if (this.storageTrieCache == null) {
    this.storageTrieCache = {};
  }

  if (this.storageTrieCache[address] != null) {
    return callback(null, this.storageTrieCache[address]);
  }

  callback(null, this.createFallbackStorageTrie(address));
};

BlockchainDouble.prototype.getAccount = function(address, callback) {
  var addressHex = utils.addHexPrefix(address.toString('hex'))

  this.lookupStorageTrie(address, function(err, trie) {
    if (err) return callback(err);
    trie.getAccount(addressHex, callback);
  });
};

BlockchainDouble.prototype.latestBlock = function() {
  return this.blocks[this.height];
}

// Callback included for integration with ethereumjs-vm
BlockchainDouble.prototype.getBlock = function(number, callback){
  var block;

  if (typeof number == "string") {
    // If we have a hex number or a block hash
    if (number.indexOf("0x") >= 0) {
      var hash = number;

      // block hash
      if (hash.length > 40) {
        block = this.blockHashes[to.hex(hash)];
      } else {
        // Block number
        block = this.blocks[to.number(hash)]
      }
    } else {
      if (number == "latest" || number == "pending") {
        block = this.latestBlock();
      } else if (number == "earliest") {
        block = this.blocks[0];
      }
    }
  } else {
    block = this.blocks[number];
  }

  if (block == null) {
    throw new Error("Couldn't find block by reference: " + number);
  }

  if (callback) {
    return callback(null, block);
  }

  return block;
};

BlockchainDouble.prototype.putBlock = function(block) {
  // Lock in the state root for this block.
  block.header.stateRoot = this.stateTrie.root;

  this.blocks.push(block);
  this.blockHashes[to.hex(block.hash())] = block;
  this.height += 1;
};

BlockchainDouble.prototype.createBlock = function() {
  var block = new Block();
  var parent = this.height > 0 ? this.getBlock(this.height) : null;

  block.header.gasLimit = this.gasLimit;

  // Ensure we have the right block number for the VM.
  block.header.number = to.hex(this.height + 1);

  // Set the timestamp before processing txs
  block.header.timestamp = to.hex(this.currentTime());

  if (parent != null) {
    block.header.parentHash = to.hex(parent.hash());
  }

  return block;
};

BlockchainDouble.prototype.getQueuedNonce = function(address, callback) {
  var nonce = 0;

  this.pending_transactions.forEach(function(tx) {
    if (tx.from != address) return;

    var pending_nonce = to.number(tx.nonce);
    if (pending_nonce > nonce) {
      nonce = pending_nonce;
    }
  });

  if (nonce > 0) return callback(null, nonce);

  this.stateTrie.get(address, function(err, val) {
    if (err) return callback(err);

    var account = new Account(val);
    callback(null, account.nonce);
  });
};

BlockchainDouble.prototype.queueTransaction = function(tx) {
  this.pending_transactions.push(tx);
};

BlockchainDouble.prototype.processNextBlock = function(callback) {
  var self = this;
  var block = this.createBlock();

  Array.prototype.push.apply(block.transactions, this.pending_transactions);

  this.vm.runBlock({
    block: block,
    generate: true,
  }, function(err, results) {
    if (err) {
      block.transactions.pop();
      callback(err);
      return;
    }

    if (results.error != null) {
      block.transactions.pop();
      callback(new Error("VM error: " + results.error));
      return;
    }

    self.putBlock(block);
    self.pending_transactions = [];

    callback(null, results);
  });
};

BlockchainDouble.prototype.getStorage = function(address, key, number, callback) {
  if (!this.fallback) {
    return this.getDirectStorage(address, key, number, callback);
  }

  this.lookupStorageTrie(address, function(err, trie) {
    if (err) return callback(err);
    trie.get(key, callback);
  });
}

BlockchainDouble.prototype.getDirectStorage = function(address, position, number, callback) {
  var self = this;

  var block = this.getBlock(number);
  var trie = this.stateTrie;

  //console.log("eth_getStorageAt", address, position, number);

  // Manipulate the state root in place to maintain checkpoints
  var currentStateRoot = trie.root;
  this.stateTrie.root = block.header.stateRoot;

  trie.get(utils.toBuffer(address), function(err, data) {
    if (err != null) {
      // Put the stateRoot back if there's an error
      trie.root = currentStateRoot;
      return callback(err);
    }

    var account = new Account(data);

    trie.root = account.stateRoot;

    trie.get(utils.toBuffer(position), function(err, value) {
      // Finally, put the stateRoot back for good
      trie.root = currentStateRoot;

      if (err != null) {
        return callback(err);
      }

      if (value) {
        value = utils.rlp.decode(value);
      }

      value = to.hex(value || 0);
      callback(null, value);
    });
  });
}

BlockchainDouble.prototype.getCode = function(address, callback) {
  address = to.hex(address);

  this.lookupStorageTrie(address, function(err, trie) {
    if (err) return callback(err);
    trie.getCode(address, callback);
  });
};

BlockchainDouble.prototype.getCodeDirect = function(address, callback) {
  var self = this;

  var address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getContractCode(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      callback(null, to.hex(result));
    }
  });
};

// Remove blocks from the chain. Used for snapshotting.
BlockchainDouble.prototype.revert = function(number) {
  this.blocks.splice(number);
};

BlockchainDouble.prototype.currentTime = function() {
  return new Date().getTime() / 1000 | 0;
};

module.exports = BlockchainDouble;
