var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var VM = require('ethereumjs-vm');
var Trie = require('merkle-patricia-tree');
var Transaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');
var crypto = require('crypto');

Blockchain = function() {
  this.stateTrie = new Trie();
  this.vm = new VM(this.stateTrie);
  this.nonces = {};
  this.blockNumber = -1;
  this.accounts = {};
  this.blocks = [];
  this.blockNum = 0;
  this.coinbase = null;
  this.contracts = {};
  this.blockHashes = {};
  this.transactions = {};
  this.latest_filter_id = 1;
  this.transaction_queue = [];
  this.transaction_processing == false;
  this.pendingBlock = this.createBlock();
  this.lastBlockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

  this.mine();
}

Blockchain.prototype.toHex = function(val) {
  if (typeof val == "number") {
    val = utils.intToHex(val);
  }

  if (val instanceof Buffer) {
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
  block.header.gasLimit = '0x2fefd8';
  return block;
}

Blockchain.prototype.mine = function() {
  this.blockNumber += 1;
  var block = this.pendingBlock;
  var parent = this.blocks.length != 0 ? this.blocks[this.blocks.length - 1] : null;

  // Update the header for when the block was mined.
  block.header.timestamp = this.toHex(new Date().getTime());
  block.header.number = this.toHex(this.blockNumber);

  if (parent != null) {
    block.header.parentHash = this.toHex(parent.hash());
  }

  this.blocks.push(block);

  // Update our caches.
  this.blockHashes[this.toHex(block.hash())] = block;
  this.lastBlockHash = this.toHex(block.hash());

  this.pendingBlock = this.createBlock();
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
      callback(null, self.toHex(result));
    }
  });
}

Blockchain.prototype.getTransactionCount = function(address, callback) {
  var self = this;
  address = new Buffer(utils.stripHexPrefix(address));
  this.vm.stateManager.getAccount(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      callback(null, self.toHex(result.nonce));
    }
  });
}

Blockchain.prototype.getCode = function(address) {
  address = this.toHex(address);
  return this.contracts[address] || "";
}

Blockchain.prototype.getBlockByNumber = function(number) {

  if (number == "latest" || number == "pending") {
    block = this.latestBlock();
    number = this.blocks.length - 1;
  } else {
    block = this.blocks[utils.bufferToInt(number)];
  }

  var self = this;
  return {
    number: self.toHex(number),
    hash: self.toHex(block.hash()),
    parentHash: self.toHex(block.header.parentHash),
    nonce: self.toHex(block.header.nonce),
    sha3Uncles: self.toHex(block.header.uncleHash),
    logsBloom: self.toHex(block.header.bloom),
    transactionsRoot: self.toHex(block.header.transactionTrie),
    stateRoot: self.toHex(block.header.stateRoot),
    receiptsRoot: self.toHex(block.header.receiptTrie),
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

Blockchain.prototype.queueCall = function(tx_params, callback) {
  this.queueAction("eth_call", tx_params, callback);
};

Blockchain.prototype.queueAction = function(method, tx_params, callback) {
  if (tx_params.from == null) {
    callback(new Error("from not found; is required"));
    return;
  }

  tx_params.from = this.toHex(tx_params.from);

  var rawTx = {
      gasPrice: "0x1",
      gasLimit: "0x2fefd8",
      value: '0x0',
      data: ''
  };

  if (tx_params.gasPrice != null) {
    rawTx.gasPrice = this.toHex(tx_params.gasPrice);
  }

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

  if (queued.method == "eth_sendTransaction") {
    this.processTransaction(queued.from, queued.rawTx, intermediary);
  } else {
    this.processCall(queued.from, queued.rawTx, intermediary);
  }
};

Blockchain.prototype.processTransaction = function(from, rawTx, callback) {
  var self = this;

  var block = this.pendingBlock;
  var account = new Buffer(utils.stripHexPrefix(from), "hex");
  var privateKey = new Buffer(this.accounts[from].secretKey, 'hex');

  this.vm.stateManager.getAccount(account, function(err, result) {
    // If the user specified a nonce, use that instead.
    if (rawTx.nonce == null) {
      rawTx.nonce = self.toHex(result.nonce);
    }

    var tx = new Transaction(rawTx);

    tx.sign(privateKey);

    var tx_hash = self.toHex(tx.hash());

    // Add the transaction to the block.
    block.transactions.push(tx);

    // Ensure we have the right block number for the VM.
    block.header.number = self.blockNumber + 1;

    self.vm.runBlock({
      block: block,
      generate: true
    }, function(err, results) {
      if (err) {
        callback(err);
        return;
      }

      if (results.error != null) {
        callback(new Error("VM error: " + results.error));
        return;
      }

      var receipt = results.receipts[0];
      var result = results.results[0];

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
          blockNumber: self.toHex(self.blockNumber + 1),
          address: address,
          data: data,
          topics: topics,
          type: "mined"
        });
      }

      var tx_result = {
        tx: tx,
        block_number: self.toHex(self.blockNumber + 1),
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

      if (tx_result.createdAddress != null) {
        self.contracts[tx_result.createdAddress] = rawTx.data;
      }

      self.mine();

      callback(null, tx_hash);
    });
  });
};

Blockchain.prototype.processCall = function(from, rawTx, callback) {
  var self = this;

  var block = this.latestBlock();
  var account = new Buffer(utils.stripHexPrefix(from), "hex");
  var privateKey = new Buffer(this.accounts[from].secretKey, 'hex');

  this.vm.stateManager.getAccount(account, function(err, result) {
    // If the user specified a nonce, use that instead.
    if (rawTx.nonce == null) {
      rawTx.nonce = self.toHex(result.nonce);
    }

    var tx = new Transaction(rawTx);
    tx.sign(privateKey);

    var tx_hash = self.toHex(tx.hash());

    self.stateTrie.checkpoint();

    self.vm.runTx({
      tx: tx,
      block: block
    }, function(err, results) {
      self.stateTrie.revert();

      if (err) {
        callback(err);
        return;
      }

      if (results.error != null) {
        callback(new Error("VM error: " + results.error));
        return;
      }

      callback(null, self.toHex(results.vm.return));
    });
  });
};

module.exports = Blockchain;
