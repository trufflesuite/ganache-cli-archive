var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var VM = require('ethereumjs-vm');
var Trie = require('merkle-patricia-tree');
var FakeTransaction = require('ethereumjs-tx/fake.js');
var utils = require('ethereumjs-util');
var seedrandom = require('seedrandom');
var bip39 = require('bip39');
var hdkey = require('ethereumjs-wallet/hdkey');

var Log = require("./utils/log");
var to = require('./utils/to');
var random = require('./utils/random');
var txhelper = require('./utils/txhelper');

BlockchainDouble = function(options) {
  var self = this;

  if (options == null) {
    options = {};
  }

  this.stateTrie = new Trie();
  this.vm = new VM(this.stateTrie, null, {
    enableHomestead: true
  });

  this.nonces = {};
  this.accounts = {};
  this.blocks = [];
  this.blockLogs = {};
  this.coinbase = null;
  this.contracts = {};

  // Homestead Gas Limit is 4712388 / 0x47E7C4
  this.gasLimit = options.gasLimit || '0x47E7C4';

  this.blockHashes = {};
  this.transactions = {};
  this.latest_filter_id = 1;
  this.transaction_queue = [];
  this.transaction_processing == false;
  this.lastBlockHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
  this.snapshots = [];
  this.logger = options.logger || console;
  this.net_version = new Date().getTime();
  this.rng = seedrandom(options.seed);
  this.mnemonic = options.mnemonic || bip39.entropyToMnemonic(random.randomBytes(16, this.rng));
  this.wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(this.mnemonic));
  this.wallet_hdpath = "m/44'/60'/0'/0";

  this.gasPriceVal = '1';

  if (options.debug == true) {
    this.vm.on('step', function(info){
      self.logger.log(info.opcode.name)
    });
  }

  if (options.gasPrice) {
    this.gasPriceVal = utils.stripHexPrefix(utils.intToHex(options.gasPrice));
  }

  // Create first block.
  this.mine();

  function mineOnInterval() {
    // Queue up to mine the block once the transaction is finished.
    if (self.transaction_processing == true) {
      setTimeout(mineOnInterval, 100);
    } else {
      self.mine();
      setTimeout(mineOnInterval, options.blocktime * 1000);
    }
  };

  if (options.blocktime) {
    setTimeout(mineOnInterval, options.blocktime * 1000);
  }
}

BlockchainDouble.prototype.addAccount = function(opts, callback) {
  var self = this;

  var secretKey;
  var balance;

  if (opts.secretKey) {
    secretKey = utils.toBuffer(to.hex(opts.secretKey));
  } else {
    var index = Object.keys(this.accounts).length;
    var acct = this.wallet.derivePath(this.wallet_hdpath + index) // index is a number
    secretKey = acct.getWallet().getPrivateKey() // Buffer
  }

  var publicKey = utils.privateToPublic(secretKey);
  var address = utils.publicToAddress(publicKey);

  var account = new Account();

  if (opts.balance) {
    account.balance = to.hex(opts.balance)
  } else {
    account.balance = "0x0000000000000056bc75e2d63100000";
  }

  this.stateTrie.put(address, account.serialize(), function(err, result) {
    if (err != null) {
      callback(err);
      return;
    }

    var data = {
      secretKey: secretKey,
      publicKey: publicKey,
      address: to.hex(address),
      account: account
    };

    if (self.coinbase == null) {
      self.coinbase = to.hex(address);
    }

    self.accounts[to.hex(address)] = data;

    callback();
  });
}

BlockchainDouble.prototype.accountAddresses = function() {
  return Object.keys(this.accounts);
}

BlockchainDouble.prototype.createBlock = function() {
  var block = new Block();
  var parent = this.blocks.length != 0 ? this.blocks[this.blocks.length - 1] : null;

  block.header.gasLimit = this.gasLimit;

  // Ensure we have the right block number for the VM.
  block.header.number = to.hex(this.blocks.length);

  // Set the timestamp before processing txs
  block.header.timestamp = to.hex(this.currentTime());

  if (parent != null) {
    block.header.parentHash = to.hex(parent.hash());
  }

  return block;
}

BlockchainDouble.prototype.blockFromBlockTag = function(tag) {
  var block = null;

  if (tag == "latest" || tag == "pending") {
    block = this.latestBlock();
  } else if (tag == "earliest") {
    block = this.blocks[0];
  } else {
    var blockNumber = utils.bufferToInt(utils.toBuffer(to.hex(tag)));

    if (blockNumber < this.blocks.length) {
      block = this.blocks[blockNumber];
    } else {
      block = this.latestBlock();
    }
  }

  return block;
};

BlockchainDouble.prototype.blockNumber = function() {
  return utils.bufferToInt(this.blocks[this.blocks.length - 1].header.number);
};

BlockchainDouble.prototype.currentTime = function() {
  return new Date().getTime() / 1000 | 0;
};

BlockchainDouble.prototype.mine = function(block) {
  if (block == null) {
    block = this.createBlock();
  }

  block.header.stateRoot = this.stateTrie.root;
  this.blocks.push(block);

  // Update our caches.
  this.blockHashes[to.hex(block.hash())] = block;
  this.lastBlockHash = to.hex(block.hash());
}

BlockchainDouble.prototype.latestBlock = function() {
  return this.blocks[this.blocks.length - 1];
}

BlockchainDouble.prototype.gasPrice = function() {
  return this.gasPriceVal;
}

BlockchainDouble.prototype.getBalance = function(address, callback) {
  var self = this;

  address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getAccountBalance(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      if (typeof result == "undefined") {
        result = new Buffer(0);
      }
      callback(null, to.hex(result));
    }
  });
}

BlockchainDouble.prototype.getTransactionCount = function(address, callback) {
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
      callback(null, to.hex(nonce));
    }
  });
}

BlockchainDouble.prototype.getCode = function(address, callback) {
  var self = this;

  address = new Buffer(utils.stripHexPrefix(address), "hex");
  this.vm.stateManager.getContractCode(address, function(err, result) {
    if (err != null) {
      callback(err);
    } else {
      callback(null, to.hex(result));
    }
  });
}

BlockchainDouble.prototype.getBlockByNumber = function(number) {

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
    number: to.hex(number),
    hash: to.hex(block.hash()),
    parentHash: to.hex(block.header.parentHash),
    nonce: to.hex(block.header.nonce),
    sha3Uncles: to.hex(block.header.uncleHash),
    logsBloom: to.hex(block.header.bloom),
    transactionsRoot: to.hex(block.header.transactionsTrie),
    stateRoot: to.hex(block.header.stateRoot),
    receiptRoot: to.hex(block.header.receiptTrie),
    miner: to.hex(block.header.coinbase),
    difficulty: to.hex(block.header.difficulty),
    totalDifficulty: to.hex(block.header.difficulty), // TODO: Figure out what to do here.
    extraData: to.hex(block.header.extraData),
    size: to.hex(1000), // TODO: Do something better here
    gasLimit: to.hex(block.header.gasLimit),
    gasUsed: to.hex(block.header.gasUsed),
    timestamp: to.hex(block.header.timestamp),
    transactions: block.transactions.map(function(tx) {return txhelper.toJSON(tx, block)}),
    uncles: []//block.uncleHeaders.map(function(uncleHash) {return to.hex(uncleHash)})
  };
}

BlockchainDouble.prototype.getBlockByHash = function(hash) {
  var block = this.blockHashes[to.hex(hash)];
  return this.getBlockByNumber(to.hex(block.header.number));
}

BlockchainDouble.prototype.getTransactionReceipt = function(hash) {
  var result = this.transactions[hash];

  if (result !== undefined) {
    return {
      transactionHash: hash,
      transactionIndex: to.hex(utils.intToHex(0)),
      blockHash: to.hex(result.block.hash()),
      blockNumber: to.hex(result.block_number),
      cumulativeGasUsed: to.hex(result.gasUsed),  // TODO: What should this be?
      gasUsed: to.hex(result.gasUsed),
      contractAddress: result.createdAddress,
      logs: result.logs.map(function(log) {return log.toJSON()})
    };
  }
  else {
    return null;
  }
}

BlockchainDouble.prototype.getTransactionByHash = function(hash) {
  var result = this.transactions[hash];

  if (result !== undefined) {
    return txhelper.toJSON(result.tx, result.block)
  }
  else {
    return null;
  }
}

BlockchainDouble.prototype.queueTransaction = function(tx_params, callback) {
  this.queueAction("eth_sendTransaction", tx_params, callback);
};

BlockchainDouble.prototype.queueRawTransaction = function(rawTx, callback) {
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

BlockchainDouble.prototype.queueStorage = function(address, position, block, callback) {
  this.transaction_queue.push({
    method: "eth_getStorageAt",
    address: utils.addHexPrefix(address),
    position: utils.addHexPrefix(position),
    block: block,
    callback: callback
  });

  // We know there's work, so get started.
  this.processNextAction();
}

BlockchainDouble.prototype.queueAction = function(method, tx_params, callback) {
  if (tx_params.from == null) {
    if (method === 'eth_call') {
      tx_params.from = this.coinbase;
    } else {
      callback(new Error("from not found; is required"));
      return;
    }
  }

  tx_params.from = utils.addHexPrefix(tx_params.from);

  if (method == "eth_sendTransaction" && Object.keys(this.accounts).indexOf(tx_params.from) < 0) {
    return callback(new Error("could not unlock signer account"));
  }

  var rawTx = {
      gasPrice: "0x1",
      gasLimit: "0x47e7c4",
      value: '0x0',
      data: ''
  };

  if (tx_params.gas != null) {
    rawTx.gasLimit = utils.addHexPrefix(tx_params.gas);
  }

  if (tx_params.gasPrice != null) {
    rawTx.gasPrice = utils.addHexPrefix(tx_params.gasPrice);
  }

  if (tx_params.to != null) {
    rawTx.to = utils.addHexPrefix(tx_params.to);
  }

  if (tx_params.value != null) {
    rawTx.value = utils.addHexPrefix(tx_params.value);
  }

  if (tx_params.data != null) {
    rawTx.data = utils.addHexPrefix(tx_params.data);
  }

  if (tx_params.nonce != null) {
    rawTx.nonce = utils.addHexPrefix(tx_params.nonce);
  }

  // Error checks
  if (rawTx.to && typeof rawTx.to != "string") {
    return callback(new Error("Invalid to address"));
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

BlockchainDouble.prototype.processNextAction = function(override) {
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

BlockchainDouble.prototype.sign = function(address, dataToSign) {
    var secretKey = this.accounts[to.hex(address)].secretKey;
    var sgn = utils.ecsign(new Buffer(dataToSign.replace('0x',''), 'hex'), new Buffer(secretKey));
    var r = utils.fromSigned(sgn.r);
    var s = utils.fromSigned(sgn.s);
    var v = utils.bufferToInt(sgn.v) - 27;
    r = utils.toUnsigned(r).toString('hex');
    s = utils.toUnsigned(s).toString('hex');
    v = utils.stripHexPrefix(utils.intToHex(v));
    return utils.addHexPrefix(r.concat(s, v));
};

BlockchainDouble.prototype.processTransaction = function(from, rawTx, callback) {
  var self = this;

  var block = this.createBlock();
  var address = utils.toBuffer(from);

  this.stateTrie.get(address, function(err, val) {
    var account = new Account(val);

    // If the user specified a nonce, use that instead.
    if (rawTx.nonce == null) {
      rawTx.nonce = to.hex(account.nonce);
    }

    if (rawTx.to == '0x0') {
      delete rawTx.to
    }

    var tx = new FakeTransaction(rawTx);
    tx.from = address;

    var tx_hash = to.hex(tx.hash());

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
        var address = to.hex(log[0]);
        var topics = []

        for (var j = 0; j < log[1].length; j++) {
          topics.push(to.hex(log[1][j]));
        }

        var data = to.hex(log[2]);

        logs.push(new Log({
          logIndex: to.hex(i),
          transactionIndex: "0x0",
          transactionHash: tx_hash,
          block: block,
          address: address,
          data: data,
          topics: topics,
          type: "mined"
        }));
      }

      var tx_result = {
        tx: tx,
        block_number: to.hex(block.header.number),
        block: block,
        stateRoot: to.hex(receipt.stateRoot),
        gasUsed: to.hex(receipt.gasUsed),
        bitvector: to.hex(receipt.bitvector),
        logs: logs,
        createdAddress: result.createdAddress != null ? to.hex(result.createdAddress) : null,
        bloom: result.bloom,
        amountSpent: result.amountSpent
      };

      self.transactions[tx_hash] = tx_result;
      self.blockLogs[to.hex(block.header.number)] = logs;

      self.logger.log("");
      self.logger.log("  Transaction: " + tx_hash);

      if (tx_result.createdAddress != null) {
        self.logger.log("  Contract created: " + tx_result.createdAddress);
        self.contracts[tx_result.createdAddress] = rawTx.data;
      }

      self.logger.log("  Gas usage: " + utils.bufferToInt(to.hex(tx_result.gasUsed)));
      self.logger.log("  Block Number: " + to.hex(block.header.number));
      self.logger.log("");

      self.mine(block);

      callback(null, tx_hash);
    });
  });
};

BlockchainDouble.prototype.processStorageRequest = function(address, position, number, callback) {
  var self = this;

  var block = this.blockFromBlockTag(number);
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

BlockchainDouble.prototype.getLogs = function(filter) {
  var fromblock, toblock;

  if (filter.fromBlock == null || filter.fromBlock == "latest") {
    fromblock = this.latestBlock();
  } else {
    var blockNumber = utils.bufferToInt(utils.toBuffer(to.hex(filter.fromBlock)));

    if (blockNumber >= this.blocks.length) {
      fromblock = this.latestBlock();
    } else {
      fromblock = this.blocks[blockNumber];
    }
  }

  if (filter.toBlock == null || filter.toBlock == "latest") {
    toblock = this.latestBlock();
  } else {
    var blockNumber = utils.bufferToInt(utils.toBuffer(to.hex(filter.toBlock)));
    toblock = this.blocks[blockNumber];
  }

  var logs = [];

  for (var i = utils.bufferToInt(fromblock.header.number); i <= utils.bufferToInt(toblock.header.number); i++) {
    var hexnumber = to.hex(i);
    logs.push.apply(logs, this.blockLogs[hexnumber]);
  }

  return logs;
};

// Note: Snapshots have 1-based ids.
BlockchainDouble.prototype.snapshot = function() {
  this.snapshots.push({
    root: this.stateTrie.root,
    blockNumber: this.blocks.length - 1
  });

  this.vm.stateManager.checkpoint();

  this.logger.log("Saved snapshot #" + this.snapshots.length);

  return to.hex(this.snapshots.length);
};

BlockchainDouble.prototype.revert = function(snapshot_id) {
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

module.exports = BlockchainDouble;
