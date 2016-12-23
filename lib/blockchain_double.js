var inherits = require("util").inherits;
var to = require("./utils/to.js");
var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var Blockchain = require('ethereumjs-blockchain');
var Log = require("./utils/log");
var Receipt = require("./utils/receipt");
var VM = require('ethereumjs-vm');
var Trie = require("merkle-patricia-tree/secure");
var Web3 = require("web3");
var utils = require("ethereumjs-util");
var async = require('async');
var createNewGenesis = require('./createNewGenesis.js');
var RuntimeError = require("./utils/runtimeerror");
var txhelper = require('./utils/txhelper.js');
var Heap = require("heap");
var Transaction = require("ethereumjs-tx");

function BlockchainDouble(options) {
  var self = this;

  this.db = options.db;

  options = options || {};

  this.logger = options.logger || console;

  this.stateTrie = options.trie || new Trie(this.db);

  this.vm = options.vm || new VM({
    state: this.stateTrie,
    blockchain: this,
    enableHomestead: true,
    activatePrecompiles: true
  });

  this.pending_transactions = [];
  // TODO - put transactions and reciepts in the db
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

BlockchainDouble.prototype.initialize = function (accounts, block) {
  var self = this;
  var callback = Array.prototype.slice.call(arguments).pop();
  function waitForDbInit() {
    if(self.db._status === "open") {
      self._initialize(accounts, block, callback);
    } else {
      setTimeout(waitForDbInit, 100);
    }
  }
  waitForDbInit();
}

BlockchainDouble.prototype._initialize = function(accounts, block) {
  var self = this;
  var callback = Array.prototype.slice.call(arguments).pop();

  accounts = accounts || [];

  // TODO - This is bad style and should be refactored
  //        together with ethereumjs-blockchain
  //        and include a callback
  function waitForBlockchainInit() {
    if(self.blockchain._initDone) {
      callback();
    } else {
      setTimeout(waitForBlockchainInit, 100);
    }
  }

  var alloc = {};
  accounts.forEach(a => {
    alloc[a.address] = '0x0000000000000056bc75e2d63100000';
  });

  // Initialize a new blockchain
  if( !self.blockchain ) {
    createNewGenesis(self.db, {timestamp: Math.floor(+(new Date())/1000) + this.timeAdjustment, gasLimit: this.blockGasLimit, alloc: alloc} , (err, res) => {
      if (err) return callback(err);
      self.stateTrie.root = res.stateRoot;
      self.blockchain = new Blockchain(self.db, false);
        waitForBlockchainInit();
    });
  } else { // Initialize a forked blockchain
    self.blockchain.forkMode = true;
    self.putBlock(block, [], [], (err, res) => {
      self.blockchain.forkMode = false;
      callback(err, res)
    }); // TODO - logs + receipts
  }
  self.vm.stateManager.blockchain = self;
};

BlockchainDouble.prototype.latestBlock = function(callback) {
  this.blockchain.getHead(callback);
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
  if (number == "latest" || number == "pending") {
    this.blockchain.getHead("vm", callback);
  } else {
    var num = to.hex(number).slice(2);
    if( num.length % 2 === 1) num = "0"+num;
    this.blockchain.getBlock(new Buffer(num,"hex"), callback);
  }
};

BlockchainDouble.prototype.putBlock = function(block, logs, receipts) {
  var self = this;

  // callback is the last argument
  var callback = Array.prototype.slice.call(arguments).pop();

  // Lock in the state root for this block.
  block.header.stateRoot = this.stateTrie.root;

  logs = logs || [];
  receipts = receipts || []

  async.eachOf(block.transactions, (tx, index, cb) => {
    var txJson = txhelper.toJSON(tx, block);
    let hash = tx.hash().toString("hex");
    this.db.put(
      new Buffer('tx' + hash),
      txJson,
      {valueEncoding: 'json'},
      () => {
        this.db.put(
          new Buffer('txr' + hash),
          receipts[index].toJSON(),
          { valueEncoding: 'json' },
          () => {
            cb();
        })
    })
  }, () => {
    this.db.put(new Buffer('logs' + block.hash()), logs, {
      valueEncoding: 'json'
    }, () => {
      self.blockchain.putBlock(block, (err, res) => {
        callback();
      });
    })
  })


};

BlockchainDouble.prototype.popBlock = function(cb) {
  var self = this;

  self.getBlock("latest", (err, block) => {
    if( parseInt(block.header.number) === 0 ) {
      cb();
    } else {
      self.blockchain.meta.rawHead = block.header.parentHash;
      self.blockchain.meta.height --;
      self.blockchain._saveMeta(() => {
        cb(null, block);
      });
    }
  });

  this._revertTrie();
};

BlockchainDouble.prototype.clearPendingTransactions = function() {
  this.pending_transactions = [];
};

BlockchainDouble.prototype.putAccount = function(account, address, callback) {
  address = utils.toBuffer(address);

  this.stateTrie.put(address, account.serialize(), callback);
};

BlockchainDouble.prototype.createBlock = function(callback) {
  this.latestBlock((err, parent) => {
    var parentJson = parent.header.toJSON();
    parentJson[8] = parentJson[8]==='0x' ? '0x01' : '0x'+(parseInt(parentJson[8]).toString(16));

    // Create new block based on parents parameter
    var block = new Block([parentJson, [], []]);

    // Ensure we have the right block number for the VM.
    block.header.number = utils.bufferToInt(parent.header.number) + 1;

    block.header.timestamp = to.hex(this.currentTime());
    block.header.parentHash = to.hex(parent.hash());
    callback(null, block);
  });
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
  for (var idx in self.pending_transactions){
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
  for (var address in sortedByNonce){
    Array.prototype.sort.apply(sortedByNonce[address], [nonceSort])
  }

  // Initialise a heap, sorted by price, for the head transaction from each account.
  var heap = new Heap(priceSort);
  for (var address in sortedByNonce){
    heap.push(sortedByNonce[address][0]);
    //Remove the transaction from sortedByNonce
    sortedByNonce[address].splice(0,1);
  }

  // Now reorder our transactions. Compare the next transactions from each account, and choose
  // the one with the highest gas price.
  var sorted_transactions = [];
  var best;
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

  // TODO - error handling and async.waterfall
  this.createBlock((err, block) => {

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

    this._checkpointTrie();
    this.vm.runBlock({
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
      };

      self.putBlock(block, logs, receipts, () => {
        // Note we return the err here too, if it exists.
        callback(err, block.transactions, results);
      });
    });
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

      trie.get(utils.setLengthLeft(utils.toBuffer(position), 32), function(err, value) {
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
  hash = to.hex(hash).slice(2);

  this.db.get(
    new Buffer("tx"+hash),
    {valueEncoding: "json"},
    (err, res) => {
      if(err || !res) return callback();
      callback(null, res);
    }
  );
};

BlockchainDouble.prototype.getTransactionReceipt = function(hash, callback) {
  hash = to.hex(hash).slice(2);

  this.db.get(
    new Buffer("txr"+hash),
    {valueEncoding: "json"},
    (err, rec) => {
      if(err || !rec) return callback();
      // TODO - either create a real receipt object here or refactor the code to work with a json receipt in case this is possible. This would create less overhead
      // new Receipt(tx, block, tx_logs, receipt.gasUsed, result.createdAddress)
      callback(null, rec);
  });
};

BlockchainDouble.prototype._checkpointTrie = function() {
  this.vm.stateManager.checkpoint();
};

BlockchainDouble.prototype._revertTrie = function() {
  this.vm.stateManager.revert(function() {});
};

BlockchainDouble.prototype.getBlockLogs = function(number, callback) {
  var self = this;
  var height = this.getHeight();
  this.getBlock(number, (err, block) => {
    this.db.get(new Buffer("logs"+block.hash()), {valueEncoding: "json"}, callback);
  });
};

BlockchainDouble.prototype.getHeight = function() {
  return this.blockchain.meta.height;
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
