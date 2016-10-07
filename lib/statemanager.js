var Account = require('ethereumjs-account');
var Block = require('ethereumjs-block');
var VM = require('ethereumjs-vm');
var Trie = require('merkle-patricia-tree');
var FakeTransaction = require('ethereumjs-tx/fake.js');
var utils = require('ethereumjs-util');
var seedrandom = require('seedrandom');
var bip39 = require('bip39');
var hdkey = require('ethereumjs-wallet/hdkey');
var async = require("async");
var BlockchainDouble = require("./blockchain_double.js");
var ForkedBlockchain = require("./utils/forkedblockchain.js");
var Web3 = require('web3');

var to = require('./utils/to');
var random = require('./utils/random');
var txhelper = require('./utils/txhelper');

StateManager = function(options) {
  var self = this;

  if (options == null) {
    options = {};
  }

  if (options.fork) {
    this.blockchain = new ForkedBlockchain(options);
  } else {
    this.blockchain = new BlockchainDouble(options);
  }

  this.vm = this.blockchain.vm;
  this.stateTrie = this.blockchain.stateTrie;

  this.accounts = {};
  this.coinbase = null;

  this.latest_filter_id = 1;
  this.transaction_queue = [];
  this.transaction_processing == false;
  this.snapshots = [];
  this.logger = options.logger || console;
  this.net_version = options.network_id;
  this.rng = seedrandom(options.seed);
  this.mnemonic = options.mnemonic || bip39.entropyToMnemonic(random.randomBytes(16, this.rng));
  this.wallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(this.mnemonic));
  this.wallet_hdpath = "m/44'/60'/0'/0/";

  this.gasPriceVal = '1';

  if (options.gasPrice) {
    this.gasPriceVal = utils.stripHexPrefix(utils.intToHex(options.gasPrice));
  }
}

StateManager.prototype.initialize = function(options, callback) {
  var self = this;

  var accounts = [];

  var total_accounts = this.total_accounts || 10;

  if (options.accounts) {
    accounts = options.accounts.map(this.createAccount.bind(this));
  } else {
    for (var i = 0; i < total_accounts; i++) {
      accounts.push(self.createAccount({
        index: i
      }));
    }
  }

  this.coinbase = to.hex(accounts[0].address);
  this.accounts = {};

  accounts.forEach(function(data) {
    self.accounts[data.address] = data;
  });

  this.blockchain.initialize(accounts, function(err) {
    if (err) return callback(err);

    // If the user didn't pass a specific version id in, then use the
    // forked blockchain's version (if it exists) or create our own.
    if (!self.net_version) {
      self.net_version = self.blockchain.fork_version || new Date().getTime();
    }

    if (options.blocktime) {
      self.blocktime = options.blocktime;
      setTimeout(self.mineOnInterval.bind(self), self.blocktime * 1000);
    }

    callback();
  });
};

StateManager.prototype.mineOnInterval = function() {
  var self = this;

  // Queue up to mine the block once the transaction is finished.
  if (this.transaction_processing == true) {
    setTimeout(this.mineOnInterval.bind(this), 100);
  } else {
    this.blockchain.processNextBlock(function(err) {
      // TODO: What do we do with the errors?
      setTimeout(self.mineOnInterval.bind(self), self.blocktime * 1000);
    });
  }
};

StateManager.prototype.createAccount = function(opts) {
  var secretKey;
  var balance;

  if (opts.secretKey) {
    secretKey = utils.toBuffer(to.hex(opts.secretKey));
  } else {
    var acct = this.wallet.derivePath(this.wallet_hdpath + opts.index) // index is a number
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

  var data = {
    secretKey: secretKey,
    publicKey: publicKey,
    address: to.hex(address),
    account: account
  };

  return data;
};

StateManager.prototype.blockNumber = function() {
  return this.blockchain.getHeight();
};

StateManager.prototype.gasPrice = function() {
  return this.gasPriceVal;
}

StateManager.prototype.getBalance = function(address, number, callback) {
  this.blockchain.getBalance(address, number, function(err, balance) {
    if (balance) {
      balance = to.hex(balance);
    }
    callback(err, balance);
  });
}

StateManager.prototype.getTransactionCount = function(address, number, callback) {
  this.blockchain.getNonce(address, number, function(err, nonce) {
    if (nonce) {
      nonce = to.hex(nonce);
    }
    callback(err, nonce);
  });
}

StateManager.prototype.getCode = function(address, number, callback) {
  this.blockchain.getCode(address, number, function(err, code) {
    if (code) {
      code = to.hex(code);
    }
    callback(err, code);
  });
}

StateManager.prototype.queueRawTransaction = function(rawTx, callback) {
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

  this.queueTransaction("eth_sendRawTransaction", txParams, callback);
};

StateManager.prototype.queueStorage = function(address, position, block, callback) {
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

StateManager.prototype.queueTransaction = function(method, tx_params, callback) {
  if (tx_params.from == null) {
    callback(new Error("from not found; is required"));
    return;
  }

  tx_params.from = utils.addHexPrefix(tx_params.from);

  if (method == "eth_sendTransaction" && Object.keys(this.accounts).indexOf(tx_params.from) < 0) {
    return callback(new Error("could not unlock signer account"));
  }

  var rawTx = {
      gasPrice: "0x1",
      gasLimit: this.blockchain.gasLimit,
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

  // Get the nonce for this address, taking account any transactions already queued.
  var self = this;
  var address = utils.toBuffer(tx_params.from);
  this.blockchain.getQueuedNonce(address, function(err, nonce) {
    // If the user specified a nonce, use that instead.
    if (rawTx.nonce == null) {
      rawTx.nonce = to.hex(nonce);
    }

    // Edit: Why is this here?
    if (rawTx.to == '0x0') {
      delete rawTx.to
    }

    var tx = new FakeTransaction(rawTx);
    tx.from = address;

    self.transaction_queue.push({
      method: method,
      from: tx_params.from,
      tx: tx,
      callback: callback
    });

    // We know there's work, so get started.
    self.processNextAction();
  });
};

StateManager.prototype.processNextAction = function(override) {
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
    this.blockchain.getStorage(queued.address, queued.position, queued.block, function(err, result) {
      if (err) return intermediary(err);

      if (result) {
        result = utils.rlp.decode(result);
      }

      result = to.hex(result || 0);
      intermediary(null, result);
    });
  } else if (queued.method == "eth_sendTransaction" || queued.method == "eth_sendRawTransaction") {
    this.processTransaction(queued.from, queued.tx, intermediary);
  }
};

StateManager.prototype.sign = function(address, dataToSign) {
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

StateManager.prototype.processTransaction = function(from, tx, callback) {
  var self = this;

  this.blockchain.queueTransaction(tx);

  this.blockchain.processNextBlock(function(err, results) {
    if (err) return callback(err);

    var tx_hash = to.hex(tx.hash());

    var result = results.results[0];

    if (result.vm.exception != 1) {
      callback(new Error("VM Exception while executing transaction: " + result.vm.exceptionError));
      return;
    }

    var block = self.blockchain.latestBlock();

    self.blockchain.getTransactionReceipt(tx_hash, function(err, receipt) {
      receipt = receipt.toJSON();

      self.logger.log("");
      self.logger.log("  Transaction: " + tx_hash);

      if (receipt.contractAddress != null) {
        self.logger.log("  Contract created: " + receipt.contractAddress);
      }

      self.logger.log("  Gas usage: " + receipt.gasUsed);
      self.logger.log("  Block Number: " + receipt.blockNumber);
      self.logger.log("  Block Time: " + new Date(to.number(block.header.timestamp) * 1000).toString());
      self.logger.log("");

      callback(null, tx_hash);
    });
  });
};

StateManager.prototype.getTransactionReceipt = function(hash, callback) {
  this.blockchain.getTransactionReceipt(hash, callback);
};

StateManager.prototype.getLogs = function(filter, callback) {
  var self = this;

  var expectedAddress = filter.address;
  var fromBlock = this.blockchain.getEffectiveBlockNumber(filter.fromBlock || "latest");
  var toBlock = this.blockchain.getEffectiveBlockNumber(filter.toBlock || "latest");

  var logs = [];
  var current = fromBlock;

  async.whilst(function() {
    return current <= toBlock;
  }, function(finished) {
    self.blockchain.getBlockLogs(current, function(err, blockLogs) {
      if (err) return finished(err);

      var filtered = blockLogs.filter(function(log) {
        return expectedAddress == null || log.address == expectedAddress;
      });

      logs.push.apply(logs, filtered);

      current += 1;
      finished();
    });
  }, function(err) {
    if (err) return callback(err);

    logs = logs.map(function(log) {
      return log.toJSON();
    });

    callback(err, logs);
  });
};

// Note: Snapshots have 1-based ids.
StateManager.prototype.snapshot = function(callback) {
  var self = this;

  this.snapshots.push({
    blockNumber: self.blockchain.getHeight()
  });

  this.logger.log("Saved snapshot #" + self.snapshots.length);

  return to.hex(self.snapshots.length);
};

StateManager.prototype.revert = function(snapshot_id, callback) {
  var self = this;

  // Convert from hex.
  snapshot_id = utils.bufferToInt(snapshot_id);

  this.logger.log("Reverting to snapshot #" + snapshot_id);

  if (snapshot_id > this.snapshots.length) {
    return false;
  }

  // Convert to zero based.
  snapshot_id = snapshot_id - 1;

  while (self.snapshots.length > snapshot_id) {
    var snapshot = this.snapshots.pop();

    while (self.blockchain.getHeight() > snapshot.blockNumber) {
      self.blockchain.popBlock();
    }
  }

  return true;
};

StateManager.prototype.hasContractCode = function(address, callback) {
  this.vm.stateManager.getContractCode( address, function( err, result ) {
    if( err != null ) {
      callback( err, false );
    } else {
      callback( null, true );
    }
  });
}

module.exports = StateManager;
