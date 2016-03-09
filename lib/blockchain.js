var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var VM = require('ethereumjs-vm');
var Trie = require('merkle-patricia-tree');
var FakeTransaction = require('ethereumjs-tx/fake.js');
var utils = require('ethereumjs-util');
var crypto = require('crypto');

Blockchain = function(logger, options) {
  this.stateTrie = new Trie();
  this.vm = new VM(this.stateTrie);
  this.nonces = {};
  this.accounts = {};
  this.blocks = [];
  this.blockLogs = {};
  this.coinbase = null;
  this.contracts = {};
  this.gasLimit = options.gasLimit || '0x2fefd8';
  this.blockHashes = {};
  this.transactions = {};
  this.latest_filter_id = 1;
  this.transaction_queue = [];
  this.transaction_processing == false;
  this.lastBlockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  this.snapshots = [];
  this.logger = logger || console;

  if (options.debug == true) {
    this.vm.on('step', function(info){
      logger.log(info.opcode.name)
    });
  }

  this.mine(this.createBlock());
}

Blockchain.prototype.toHex = function(val) {
  if (typeof val == "number") {
    val = utils.intToHex(val);
  }

  // Support Buffer, BigInteger and BN library
  // Hint: BN is used in ethereumjs
  if (typeof val == "object") {
    val = val.toString("hex");

    if (val == "") {
      val = "0";
    }
  }

  return utils.addHexPrefix(val);
}

Blockchain.prototype.addAccount = function(callback) {
  var self = this;

  var secretKey = crypto.randomBytes(32);
  var publicKey = utils.privateToPublic(new Buffer(secretKey));
  var address = utils.pubToAddress(new Buffer(publicKey));

  account = new Account();
  account.balance = "0xffffffffffffff00000000000000001";

  this.stateTrie.put(address, account.serialize(), function(err, result) {
    if (err != null) {
      callback(err);
      return;
    }

    var data = {
      secretKey: secretKey,
      publicKey: publicKey,
      address: self.toHex(address),
      account: account
    };

    if (self.coinbase == null) {
      self.coinbase = self.toHex(address);
    }

    self.accounts[self.toHex(address)] = data;

    callback();
  });
}

Blockchain.prototype.accountAddresses = function() {
  return Object.keys(this.accounts);
}

Blockchain.prototype.createBlock = function() {
  var block = new Block();
  var parent = this.blocks.length != 0 ? this.blocks[this.blocks.length - 1] : null;

  block.header.gasLimit = this.gasLimit;

  // Ensure we have the right block number for the VM.
  block.header.number = this.toHex(this.blocks.length);

  // Set the timestamp before processing txs
  block.header.timestamp = this.toHex(this.currentTime());

  if (parent != null) {
    block.header.parentHash = this.toHex(parent.hash());
  }

  return block;
}

Blockchain.prototype.blockFromBlockTag = function(tag) {
  var block = null;

  if (tag == "latest" || tag == "pending") {
    block = this.latestBlock();
  } else if (tag == "earliest") {
    block = this.blocks[0];
  } else {
    var blockNumber = utils.bufferToInt(tag);

    if (blockNumber < this.blocks.length) {
      block = this.blocks[blockNumber];
    } else {
      block = this.latestBlock();
    }
  }

  return block;
};

Blockchain.prototype.blockNumber = function() {
  return utils.bufferToInt(this.blocks[this.blocks.length - 1].header.number);
};

Blockchain.prototype.currentTime = function() {
  return new Date().getTime() / 1000 | 0;
};

Blockchain.prototype.mine = function(block) {
  block.header.stateRoot = this.stateTrie.root;
  this.blocks.push(block);

  // Update our caches.
  this.blockHashes[this.toHex(block.hash())] = block;
  this.lastBlockHash = this.toHex(block.hash());
}

Blockchain.prototype.latestBlock = function() {
  return this.blocks[this.blocks.length - 1];
}

Blockchain.prototype.gasPrice = function() {
  return '1';
}

Blockchain.prototype.getBalance = function(address, callback) {
  var self = this;

  address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getAccountBalance(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      if (typeof result == "undefined") {
        result = new Buffer(0);
      }
      callback(null, self.toHex(result));
    }
  });
}

Blockchain.prototype.getTransactionCount = function(address, callback) {
  var self = this;
  address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getAccount(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      var nonce = result.nonce;
      if (typeof nonce == "undefined") {
        nonce = new Buffer(0);
      }
      callback(null, self.toHex(nonce));
    }
  });
}

Blockchain.prototype.getCode = function(address, callback) {
  var self = this;

  address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getContractCode(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      callback(null, self.toHex(result));
    }
  });
}

Blockchain.prototype.getBlockByNumber = function(number) {

  if (number == "latest" || number == "pending") {
    block = this.latestBlock();
    number = this.blocks.length - 1;
  } else {

    var blockNumber = utils.bufferToInt(number);

    if (blockNumber >= this.blocks.length) {
      return null;
    }

    block = this.blocks[blockNumber];
  }

  var self = this;
  return {
    number: self.toHex(number),
    hash: self.toHex(block.hash()),
    parentHash: self.toHex(block.header.parentHash),
    nonce: self.toHex(block.header.nonce),
    sha3Uncles: self.toHex(block.header.uncleHash),
    logsBloom: self.toHex(block.header.bloom),
    transactionsRoot: self.toHex(block.header.transactionsTrie),
    stateRoot: self.toHex(block.header.stateRoot),
    receiptRoot: self.toHex(block.header.receiptTrie),
    miner: self.toHex(block.header.coinbase),
    difficulty: self.toHex(block.header.difficulty),
    totalDifficulty: self.toHex(block.header.difficulty), // TODO: Figure out what to do here.
    extraData: self.toHex(block.header.extraData),
    size: self.toHex(1000), // TODO: Do something better here
    gasLimit: self.toHex(block.header.gasLimit),
    gasUsed: self.toHex(block.header.gasUsed),
    timestamp: self.toHex(block.header.timestamp),
    transactions: [], //block.transactions.map(function(tx) {return tx.toJSON(true)}),
    uncles: [], // block.uncleHeaders.map(function(uncleHash) {return self.toHex(uncleHash)})
  };
}

Blockchain.prototype.getBlockByHash = function(hash) {
  var block = this.blockHashes[this.toHex(hash)];
  return this.getBlockByNumber(this.toHex(block.header.number));
}

Blockchain.prototype.getTransactionReceipt = function(hash) {
  var result = this.transactions[hash];

  if (result !== undefined) {
    return {
      transactionHash: hash,
      transactionIndex: this.toHex(utils.intToHex(0)),
      blockHash: this.toHex(result.block.hash()),
      blockNumber: result.block_number,
      cumulativeGasUsed: result.gasUsed,  // TODO: What should this be?
      gasUsed: result.gasUsed,
      contractAddress: result.createdAddress,
      logs: result.logs
    };
  }
  else {
    return null;
  }
}

Blockchain.prototype.getTransactionByHash = function(hash) {
  var result = this.transactions[hash];

  if (result !== undefined) {
    var tx = result.tx;

    return {
      hash: hash,
      nonce: this.toHex(tx.nonce),
      blockHash: this.toHex(result.block.hash()),
      blockNumber: result.block_number,
      transactionIndex:  "0x0",
      from: this.toHex(tx.getSenderAddress()),
      to: this.toHex(tx.to),
      value: this.toHex(tx.value), // 520464
      gas: this.toHex(tx.gasLimit), // 520464
      gasPrice: this.toHex(tx.gasPrice),
      input: this.toHex(tx.data),
    };
  }
  else {
    return null;
  }
}

Blockchain.prototype.queueTransaction = function(tx_params, callback) {
  this.queueAction("eth_sendTransaction", tx_params, callback);
};

Blockchain.prototype.queueRawTransaction = function(rawTx, callback) {
  var data = new Buffer(utils.stripHexPrefix(rawTx), 'hex');

  var tx = new FakeTransaction(data);
  var txParams = {
    from:     (tx.from     && tx.from.length    ) ? '0x'+tx.from.toString('hex')     : null,
    to:       (tx.to       && tx.to.length      ) ? '0x'+tx.to.toString('hex')       : null,
    gas:      (tx.gas      && tx.gas.length     ) ? '0x'+tx.gas.toString('hex')      : null,
    gasPrice: (tx.gasPrice && tx.gasPrice.length) ? '0x'+tx.gasPrice.toString('hex') : null,
    value:    (tx.value    && tx.value.length   ) ? '0x'+tx.value.toString('hex')    : null,
    data:     (tx.data     && tx.data.length    ) ? '0x'+tx.data.toString('hex')     : null,
  }

  this.queueAction("eth_sendRawTransaction", txParams, callback);
};

Blockchain.prototype.queueStorage = function(address, position, block, callback) {
  this.transaction_queue.push({
    method: "eth_getStorageAt",
    address: this.toHex(address),
    position: this.toHex(position),
    block: block,
    callback: callback
  });

  // We know there's work, so get started.
  this.processNextAction();
}

Blockchain.prototype.queueAction = function(method, tx_params, callback) {
  if (tx_params.from == null) {
    if (method === 'eth_call') {
      tx_params.from = this.coinbase;
    } else {
      callback(new Error("from not found; is required"));
      return;
    }
  }

  tx_params.from = this.toHex(tx_params.from);

  if (method == "eth_sendTransaction" && Object.keys(this.accounts).indexOf(tx_params.from) < 0) {
    return callback(new Error("could not unlock signer account"));
  }

  var rawTx = {
      gasPrice: "0x1",
      gasLimit: "0x2fefd8",
      value: '0x0',
      data: ''
  };

  if (tx_params.gas != null) {
    rawTx.gasLimit = this.toHex(tx_params.gas);
  }

  if (tx_params.gasPrice != null) {
    rawTx.gasPrice = this.toHex(tx_params.gasPrice);
  }

  if (tx_params.to != null) {
    rawTx.to = this.toHex(tx_params.to);
  }

  if (tx_params.value != null) {
    rawTx.value = this.toHex(tx_params.value);
  }

  if (tx_params.data != null) {
    rawTx.data = this.toHex(tx_params.data);
  }

  if (tx_params.nonce != null) {
    rawTx.nonce = this.toHex(tx_params.nonce);
  }

  this.transaction_queue.push({
    method: method,
    from: tx_params.from,
    rawTx: rawTx,
    callback: callback
  });

  // We know there's work, so get started.
  this.processNextAction();
};

Blockchain.prototype.processNextAction = function(override) {
  var self = this;

  if (override != true) {
    if (this.transaction_processing == true || this.transaction_queue.length == 0) {
      return;
    }
  }

  var queued = this.transaction_queue.shift();

  this.transaction_processing = true;

  var intermediary = function(err, result) {
    queued.callback(err, result);

    if (self.transaction_queue.length > 0) {
      self.processNextAction(true);
    } else {
      self.transaction_processing = false;
    }
  };

  if (queued.method == "eth_getStorageAt") {
    this.processStorageRequest(queued.address, queued.position, queued.block, intermediary);
  } else if (queued.method == "eth_sendTransaction" || queued.method == "eth_sendRawTransaction") {
    this.processTransaction(queued.from, queued.rawTx, intermediary);
  }
};

Blockchain.prototype.sign = function(address, dataToSign) {
    var secretKey = this.accounts[this.toHex(address)].secretKey;
    var sgn = utils.ecsign(new Buffer(dataToSign.replace('0x',''), 'hex'), new Buffer(secretKey));
    var r = utils.fromSigned(sgn.r);
    var s = utils.fromSigned(sgn.s);
    var v = utils.bufferToInt(sgn.v);
    r = utils.toUnsigned(r).toString('hex');
    s = utils.toUnsigned(s).toString('hex');
    v = utils.stripHexPrefix(utils.intToHex(v));
    return this.toHex(r.concat(s, v));
};

Blockchain.prototype.processTransaction = function(from, rawTx, callback) {
  var self = this;

  var block = this.createBlock();

  var address = new Buffer(utils.stripHexPrefix(from), "hex");

  this.stateTrie.get(address, function(err, val) {
    var account = new Account(val);

    // If the user specified a nonce, use that instead.
    if (rawTx.nonce == null) {
      rawTx.nonce = self.toHex(account.nonce);
    }

    if (rawTx.to == '0x0') {
      delete rawTx.to
    }

    var tx = new FakeTransaction(rawTx);
    tx.from = address;

    var tx_hash = self.toHex(tx.hash());

    // Add the transaction to the block.
    block.transactions.push(tx);

    self.vm.runBlock({
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

      var receipt = results.receipts[0];
      var result = results.results[0];

      if (result.vm.exception != 1) {
        block.transactions.pop();
        callback(new Error("VM Exception while executing transaction: " + result.vm.exceptionError));
        return;
      }

      var logs = [];

      for (var i = 0; i < receipt.logs.length; i++) {
        var log = receipt.logs[i];
        var address = self.toHex(log[0]);
        var topics = []

        for (var j = 0; j < log[1].length; j++) {
          topics.push(self.toHex(log[1][j]));
        }

        var data = self.toHex(log[2]);

        logs.push({
          logIndex: self.toHex(i),
          transactionIndex: "0x0",
          transactionHash: tx_hash,
          blockHash: self.toHex(block.hash()),
          blockNumber: self.toHex(block.header.number),
          address: address,
          data: data,
          topics: topics,
          type: "mined"
        });
      }

      var tx_result = {
        tx: tx,
        block_number: self.toHex(block.header.number),
        block: block,
        stateRoot: self.toHex(receipt.stateRoot),
        gasUsed: self.toHex(receipt.gasUsed),
        bitvector: self.toHex(receipt.bitvector),
        logs: logs,
        createdAddress: result.createdAddress != null ? self.toHex(result.createdAddress) : null,
        bloom: result.bloom,
        amountSpent: result.amountSpent
      };

      self.transactions[tx_hash] = tx_result;
      self.blockLogs[self.toHex(block.header.number)] = logs;

      self.logger.log("");

      if (tx_result.createdAddress != null) {
        self.logger.log("  Contract created: " + tx_result.createdAddress);
        self.contracts[tx_result.createdAddress] = rawTx.data;
      }

      self.logger.log("  Gas usage: " + utils.bufferToInt(self.toHex(tx_result.gasUsed)));
      self.logger.log("");

      self.mine(block);

      callback(null, tx_hash);
    });
  });
};

Blockchain.prototype.processStorageRequest = function(address, position, number, callback) {
  var self = this;

  var block = this.blockFromBlockTag(number);

  // Manipulate the state root in place to maintain checkpoints
  var currentStateRoot = this.stateTrie.root;
  this.stateTrie.root = block.header.stateRoot;

  var trie = this.stateTrie;
  trie.get(new Buffer(utils.stripHexPrefix(address), 'hex'), function(err, data) {
    if (err != null) {
      // Put the stateRoot back if there's an error
      this.stateTrie.root = currentStateRoot;
      return callback(err);
    }

    var account = new Account(data);
    account.getStorage(trie, new Buffer(utils.stripHexPrefix(position), 'hex'), function(e, value) {
      // Finally, put the stateRoot back for good
      self.stateTrie.root = currentStateRoot;

      if (value) {
        value = utils.rlp.decode(value);
      }

      value = self.toHex(value || "0x0");
      callback(null, value);
    });
  });
}

Blockchain.prototype.getLogs = function(filter) {
  var fromblock, toblock;

  if (filter.fromBlock == null || filter.fromBlock == "latest") {
    fromblock = this.latestBlock();
  } else {
    var blockNumber = utils.bufferToInt(new Buffer(utils.stripHexPrefix(filter.fromBlock), "hex"));

    if (blockNumber >= this.blocks.length) {
      fromblock = this.latestBlock();
    } else {
      fromblock = this.blocks[blockNumber];
    }
  }

  if (filter.toBlock == null || filter.toBlock == "latest") {
    toblock = this.latestBlock();
  } else {
    var blockNumber = utils.bufferToInt(new Buffer(utils.stripHexPrefix(filter.toBlock), "hex"));
    toblock = this.blocks[blockNumber];
  }

  var logs = [];

  for (var i = utils.bufferToInt(fromblock.header.number); i <= utils.bufferToInt(toblock.header.number); i++) {
    var hexnumber = this.toHex(i);
    logs.push.apply(logs, this.blockLogs[hexnumber]);
  }

  return logs;
};

// Note: Snapshots have 1-based ids.
Blockchain.prototype.snapshot = function() {
  this.snapshots.push({
    root: this.stateTrie.root,
    blockNumber: this.blocks.length - 1
  });

  this.vm.stateManager.checkpoint();

  this.logger.log("Saved snapshot #" + this.snapshots.length);

  return this.toHex(this.snapshots.length);
};

Blockchain.prototype.revert = function(snapshot_id) {
  // Convert from hex.
  snapshot_id = utils.bufferToInt(snapshot_id);

  this.logger.log("Reverting to snapshot #" + snapshot_id);

  if (snapshot_id > this.snapshots.length) {
    return false;
  }

  // Convert to zero based.
  snapshot_id = snapshot_id - 1;

  var snapshot = this.snapshots[snapshot_id];

  // Revert to previous state.
  while (this.snapshots.length > snapshot_id) {
    var snapshot = this.snapshots.pop();
    this.stateTrie.root = snapshot.root;
    this.vm.stateManager.revert(function() {});

    this.blocks.splice(snapshot.blockNumber + 1);
  }

  return true;
};

module.exports = Blockchain;
