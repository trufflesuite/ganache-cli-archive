var inherits = require("util").inherits;
var to = require("./utils/to.js");
var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var Log = require("./utils/log");
var Receipt = require("./utils/receipt");
var VM = require('ethereumjs-vm');
var RuntimeError = require("./utils/runtimeerror");
var Trie = require("merkle-patricia-tree");
var Web3 = require("web3");
var utils = require("ethereumjs-util");
var async = require('async');
var Heap = require("heap");

function BlockchainDouble(options) {
  var self = this;

  options = options || {};

  this.logger = options.logger || console;

  this.stateTrie = options.trie || new Trie();

  this.vm = options.vm || new VM(this.stateTrie, this, {
    enableHomestead: true,
    activatePrecompiles: true
  });

  this.blocks = [];
  this.blockHashes = {};
  this.blockLogs = [];
  this.pending_transactions = [];
  this.transactions = {};
  this.transactionReceipts = {};

  if (options.debug == true) {
    this.vm.on('step', function(info){
      self.logger.log(info.opcode.name)
    });
  }

  // Homestead block gas limit is 4712388 == 0x47E7C4
  // Default transaction gas limit is 90000 == 0x15f90
  this.blockGasLimit = options.gasLimit || "0x47E7C4";
  this.defaultTransactionGasLimit = '0x15f90';
  this.timeAdjustment = options.timeAdjustment || 0;

  if (options.time) {
    this.setTime(options.time);
  }
};

BlockchainDouble.prototype.initialize = function(accounts, block, callback) {
  var self = this;

  if (typeof block == "function") {
    callback = block;
    block = this.createBlock();
  }

  accounts = accounts || [];

  async.eachSeries(accounts, function(account_data, finished) {
    self.putAccount(account_data.account, account_data.address, finished);
  }, function(err) {
    if (err) return callback(err);

    // Create first block
    self.putBlock(block);

    callback();
  });
};

BlockchainDouble.prototype.latestBlock = function() {
  return this.blocks[this.blocks.length - 1];
}

// number accepts number (integer, hex) or tag (e.g., "latest")
BlockchainDouble.prototype.getEffectiveBlockNumber = function(number, callback) {
  if (typeof number != "string") {
    number = to.hex(number);
  }

  // If we have a hex number
  if (number.indexOf("0x") >= 0) {
    number = to.number(number);
  } else {
    if (number == "latest" || number == "pending") {
      number = this.getHeight();
    } else if (number == "earliest") {
      number = 0;
    }
  }

  return number;
};

// number accepts number (integer, hex), tag (e.g., "latest") or block hash
// This function is used by ethereumjs-vm
BlockchainDouble.prototype.getBlock = function(number, callback){
  var block;

  if (typeof number != "string") {
    number = to.hex(number);
  }

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

  if (block == null) {
    return callback(new Error("Couldn't find block by reference: " + number));
  }

  callback(null, block);
};

BlockchainDouble.prototype.putBlock = function(block, logs, receipts) {
  var self = this;

  // Lock in the state root for this block.
  block.header.stateRoot = this.stateTrie.root;

  logs = logs || [];
  receipts = receipts || []

  this.blocks.push(block);
  this.blockLogs.push(logs);
  this.blockHashes[to.hex(block.hash())] = block;

  block.transactions.forEach(function(tx, index) {
    self.transactions[to.hex(tx.hash())] = tx;
    self.transactionReceipts[to.hex(tx.hash())] = receipts[index];
  });
};

BlockchainDouble.prototype.popBlock = function() {
  var self = this;

  if (this.blocks.length == 0) return null;

  var block = this.blocks.pop();

  this.blockLogs.pop();
  delete this.blockHashes[to.hex(block.hash())];

  block.transactions.forEach(function(tx, index) {
    delete self.transactions[to.hex(tx.hash())];
    delete self.transactionReceipts[to.hex(tx.hash())];
  });

  this._revertTrie();

  return block;
};

BlockchainDouble.prototype.clearPendingTransactions = function() {
  this.pending_transactions = [];
};

BlockchainDouble.prototype.putAccount = function(account, address, callback) {
  address = utils.toBuffer(address);

  this.stateTrie.put(address, account.serialize(), callback);
};

BlockchainDouble.prototype.createBlock = function() {
  var block = new Block();
  var parent = this.blocks.length > 0 ? this.latestBlock() : null;

  block.header.gasLimit = this.blockGasLimit;

  // Ensure we have the right block number for the VM.
  block.header.number = to.hex(this.getHeight() + 1);

  // Set the timestamp before processing txs
  block.header.timestamp = to.hex(this.currentTime());

  if (parent != null) {
    block.header.parentHash = to.hex(parent.hash());
  }

  return block;
};

BlockchainDouble.prototype.getQueuedNonce = function(address, callback) {
  var nonce = null;

  this.pending_transactions.forEach(function(tx) {
    //tx.from and address are buffers, so cannot simply do
    //tx.from==address
    if (to.hex(tx.from) != to.hex(address)) return;

    var pending_nonce = to.number(tx.nonce);
    //If this is the first queued nonce for this address we found,
    //or it's higher than the previous highest, note it.
    if (nonce===null || pending_nonce > nonce) {
      nonce = pending_nonce;
    }
  });

  //If we found a queued transaction nonce, return one higher
  //than the highest we found
  if (nonce!=null) return callback(null, nonce+1);

  this.stateTrie.get(address, function(err, val) {
    if (err) return callback(err);

    var account = new Account(val);
    callback(null, account.nonce);
  });
};

BlockchainDouble.prototype.queueTransaction = function(tx) {
  this.pending_transactions.push(tx);
};

BlockchainDouble.prototype.sortByPriceAndNonce = function() {
  // Sorts transactions like I believe geth does.
  // See the description of 'SortByPriceAndNonce' at
  // https://github.com/ethereum/go-ethereum/blob/290e851f57f5d27a1d5f0f7ad784c836e017c337/core/types/transaction.go
  var self = this;
  var sortedByNonce = {};
  for (idx in self.pending_transactions){
    var tx = self.pending_transactions[idx]
    if (!sortedByNonce[to.hex(tx.from)]){
      sortedByNonce[to.hex(tx.from)] = [tx];
    } else {
      Array.prototype.push.apply(sortedByNonce[to.hex(tx.from)], [tx]);
    }
  }
  var priceSort = function(a,b){
    return parseInt(to.hex(b.gasPrice),16)-parseInt(to.hex(a.gasPrice),16);
  }
  var nonceSort = function(a,b){
    return parseInt(to.hex(a.nonce),16) - parseInt(to.hex(b.nonce),16)
  }

  // Now sort each address by nonce
  for (address in sortedByNonce){
    Array.prototype.sort.apply(sortedByNonce[address], [nonceSort])
  }

  // Initialise a heap, sorted by price, for the head transaction from each account.
  var heap = new Heap(priceSort);
  for (address in sortedByNonce){
    heap.push(sortedByNonce[address][0]);
    //Remove the transaction from sortedByNonce
    sortedByNonce[address].splice(0,1);
  }

  // Now reorder our transactions. Compare the next transactions from each account, and choose
  // the one with the highest gas price.
  sorted_transactions = [];
  while (heap.size()>0){
    best = heap.pop();
    if (sortedByNonce[to.hex(best.from)].length>0){
      //Push on the next transaction from this account
      heap.push(sortedByNonce[address][0]);
      sortedByNonce[address].splice(0,1);
    }
    Array.prototype.push.apply(sorted_transactions, [best]);
  }
  self.pending_transactions = sorted_transactions;
};

BlockchainDouble.prototype.processNextBlock = function(callback) {
  var self = this;
  var block = this.createBlock();
  var successfullyAddedTransactions = [];

  //First, sort our transactions like geth does
  this.sortByPriceAndNonce();

  // Grab only the transactions that can fit within the block
  var currentTransactions = [];
  var totalGasLimit = 0;
  var maxGasLimit = to.number(this.blockGasLimit);

  while (this.pending_transactions.length > 0) {
    var tx = this.pending_transactions[0];
    var gasLimit = to.number(tx.gasLimit);

    if (totalGasLimit + gasLimit <= maxGasLimit) {
      totalGasLimit += gasLimit;
      this.pending_transactions.shift();
      currentTransactions.push(tx);
    } else {
      // Next one won't fit. Break.
      break;
    }
  }

  // Remember, we ensured transactions had a valid gas limit when they were queued (in the state manager).
  // If we run into a case where we can't process any because one is higher than the gas limit,
  // then it's a serious issue. This should never happen, but let's check anyway.
  if (currentTransactions.length == 0 && this.pending_transactions.length > 0) {
    // Error like geth.
    return callback("Unexpected error condition: next transaction exceeds block gas limit")
  }

  // Add transactions to the block.
  Array.prototype.push.apply(block.transactions, currentTransactions);

  self._checkpointTrie();
  self.vm.runBlock({
    block: block,
    generate: true,
  }, function(err, results) {
    // This is a check that has been in there for awhile. I'm unsure if it's required, but it can't hurt.
    if (err && err instanceof Error == false) {
      err = new Error("VM error: " + err);
    }

    // If we're given an error back directly, it's worse than a runtime error. Expose it and get out.
    if (err) return callback(err);

    // If no error, check for a runtime error. This can return null if no runtime error.
    err = RuntimeError.fromResults(block.transactions, results);

    // Note, even if we have an error, some transactions may still have succeeded.
    // Process their logs if so, returning the error at the end.

    var logs = [];
    var receipts = [];

    var totalBlockGasUsage = 0;

    results.results.forEach(function(result) {
      totalBlockGasUsage += to.number(result.gasUsed);
    });

    block.header.gasUsed = utils.toBuffer(to.hex(totalBlockGasUsage));

    for (var v = 0; v < results.receipts.length; v++) {
      var result = results.results[v];
      var receipt = results.receipts[v];
      var tx = block.transactions[v];
      var tx_hash = tx.hash();
      var tx_logs = [];

      // Only process the transaction's logs if it didn't error.
      if (result.vm.exception == 1) {
        for (var i = 0; i < receipt.logs.length; i++) {
          var log = receipt.logs[i];
          var address = to.hex(log[0]);
          var topics = []

          for (var j = 0; j < log[1].length; j++) {
            topics.push(to.hex(log[1][j]));
          }

          var data = to.hex(log[2]);

          var log = new Log({
            logIndex: to.hex(i),
            transactionIndex: to.hex(v),
            transactionHash: tx_hash,
            block: block,
            address: address,
            data: data,
            topics: topics,
            type: "mined"
          });

          logs.push(log);
          tx_logs.push(log);
        }
      }

      receipts.push(new Receipt(tx, block, tx_logs, receipt.gasUsed, result.createdAddress));
    }

    self.putBlock(block, logs, receipts);

    // Note we return the err here too, if it exists.
    callback(err, block.transactions, results);
  });
};

BlockchainDouble.prototype.getAccount = function(address, number, callback) {
  var self = this;

  this.getBlock(number, function(err, block) {
    if (err) return callback(err);

    var trie = self.stateTrie;

    // Manipulate the state root in place to maintain checkpoints
    var currentStateRoot = trie.root;
    self.stateTrie.root = block.header.stateRoot;

    trie.get(utils.toBuffer(address), function(err, data) {
      // Finally, put the stateRoot back for good
      trie.root = currentStateRoot;

      if (err) return callback(err);

      var account = new Account(data);

      account.exists = !!data;

      callback(null, account);
    });
  });
};

BlockchainDouble.prototype.getNonce = function(address, number, callback) {
  this.getAccount(address, number, function(err, account) {
    if (err) return callback(err);
    callback(null, account.nonce);
  });
};

BlockchainDouble.prototype.getBalance = function(address, number, callback) {
  this.getAccount(address, number, function(err, account) {
    if (err) return callback(err);

    callback(null, account.balance);
  });
};

// Note! Storage values are returned RLP encoded!
BlockchainDouble.prototype.getStorage = function(address, position, number, callback) {
  var self = this;

  this.getBlock(number, function(err, block) {
    if (err) return callback(err);

    var trie = self.stateTrie;

    // Manipulate the state root in place to maintain checkpoints
    var currentStateRoot = trie.root;
    self.stateTrie.root = block.header.stateRoot;

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

        callback(null, value);
      });

    });
  });
}

BlockchainDouble.prototype.getCode = function(address, number, callback) {
  var self = this;

  this.getBlock(number, function(err, block) {
    if (err) return callback(err);

    var trie = self.stateTrie;

    // Manipulate the state root in place to maintain checkpoints
    var currentStateRoot = trie.root;
    self.stateTrie.root = block.header.stateRoot;

    trie.get(utils.toBuffer(address), function(err, data) {
      if (err != null) {
        // Put the stateRoot back if there's an error
        trie.root = currentStateRoot;
        return callback(err);
      }

      var account = new Account(data);

      account.getCode(trie, function(err, code) {
        // Finally, put the stateRoot back for good
        trie.root = currentStateRoot;

        if (err) return callback(err);

        callback(null, code);
      });
    });
  });
};

BlockchainDouble.prototype.getTransaction = function(hash, callback) {
  hash = to.hex(hash);

  callback(null, this.transactions[hash]);
};

BlockchainDouble.prototype.getTransactionReceipt = function(hash, callback) {
  hash = to.hex(hash);

  callback(null, this.transactionReceipts[hash]);
};

BlockchainDouble.prototype._checkpointTrie = function() {
  this.vm.stateManager.checkpoint();
};

BlockchainDouble.prototype._revertTrie = function() {
  this.vm.stateManager.revert(function() {});
};

BlockchainDouble.prototype.getBlockLogs = function(number, callback) {
  var self = this;
  number = this.getEffectiveBlockNumber(number);
  callback(null, this.blockLogs[number]);
};

BlockchainDouble.prototype.getHeight = function() {
  return this.blocks.length - 1;
};

BlockchainDouble.prototype.currentTime = function() {
  return (new Date().getTime() / 1000 | 0) + this.timeAdjustment;
};

BlockchainDouble.prototype.increaseTime = function(seconds) {
  if (seconds < 0) seconds = 0;
  this.timeAdjustment += seconds;
  return this.timeAdjustment;
};

BlockchainDouble.prototype.setTime = function(date) {
  var now = new Date().getTime() / 1000 | 0;
  var start = date.getTime() / 1000 | 0;
  this.timeAdjustment = start - now;
}

module.exports = BlockchainDouble;
