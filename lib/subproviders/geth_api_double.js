var utils = require('ethereumjs-util');
var fs = require('fs');
var async = require('async');
var inherits = require('util').inherits;
var StateManager = require('../statemanager.js');
var to = require('../utils/to');
var txhelper = require('../utils/txhelper');
var pkg = require('../../package.json');

var Subprovider = require('web3-provider-engine/subproviders/subprovider.js');

inherits(GethApiDouble, Subprovider)

function GethApiDouble(options) {
  var self = this;

  this.state = options.state || new StateManager(options);
  this.options = options;
  this.initialized = false;

  this.state.initialize(this.options, function() {
    self.initialized = true;
  });
}

GethApiDouble.prototype.waitForInitialization = function(callback) {
  var self = this;
  if (this.initialized == false) {
    setTimeout(function() {
      self.waitForInitialization(callback);
    }, 100);
  } else {
    callback(null, this.state);
  }
}

// Function to not pass methods through until initialization is finished
GethApiDouble.prototype.handleRequest = function(payload, next, end) {
  var self = this;

  if (this.initialized == false) {
    setTimeout(this.getDelayedHandler(payload, next, end), 100);
    return;
  }

  var method = this[payload.method];

  if (method == null) {
    return end(new Error("RPC method " + payload.method + " not supported."));
  }

  var params = payload.params;
  var args = [];
  Array.prototype.push.apply(args, params);

  if (this.requiresDefaultBlockParameter(payload.method) && args.length < method.length - 1) {
    args.push("latest");
  }

  args.push(end);
  method.apply(this, args);
};

GethApiDouble.prototype.getDelayedHandler = function(payload, next, end) {
  var self = this;
  return function() {
    self.handleRequest(payload, next, end);
  }
}

GethApiDouble.prototype.requiresDefaultBlockParameter = function(method) {
  // object for O(1) lookup.
  var methods = {
    "eth_getBalance": true,
    "eth_getCode": true,
    "eth_getTransactionCount": true,
    "eth_getStorageAt": true,
    "eth_call": true
  };

  return methods[method] === true;
};

// Handle individual requests.

GethApiDouble.prototype.eth_accounts = function(callback) {
  callback(null, Object.keys(this.state.accounts));
};

GethApiDouble.prototype.eth_blockNumber = function(callback) {
  callback(null, to.hex(this.state.blockNumber()));
};

GethApiDouble.prototype.eth_coinbase = function(callback) {
  callback(null, this.state.coinbase);
};

GethApiDouble.prototype.eth_mining = function(callback) {
  callback(null, true);
};

GethApiDouble.prototype.eth_hashrate = function(callback) {
  callback(null, '0x0');
};

GethApiDouble.prototype.eth_gasPrice = function(callback) {
  callback(null, utils.addHexPrefix(this.state.gasPrice()));
};

GethApiDouble.prototype.eth_getBalance = function(address, block_number, callback) {
  this.state.getBalance(address, block_number, callback);
};

GethApiDouble.prototype.eth_getCode = function(address, block_number, callback) {
  this.state.getCode(address, block_number, callback);
};

GethApiDouble.prototype.eth_getBlockByNumber = function(block_number, include_transactions, callback) {
  this.state.blockchain.getBlock(block_number, function(err, block) {
    if (err) return callback(err);

    callback(null, {
      number: to.hex(block.header.number),
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
    });
  });
};

GethApiDouble.prototype.eth_getBlockByHash = function(tx_hash, include_transactions, callback) {
  this.eth_getBlockByNumber.apply(this, arguments);
};

GethApiDouble.prototype.eth_getTransactionReceipt = function(hash, callback) {
  this.state.getTransactionReceipt(hash, function(err, receipt) {
    if (err) return callback(err);

    var result = null;

    if (receipt){
      result = receipt.toJSON();
    }
    callback(null, result);
  });
};

GethApiDouble.prototype.eth_getTransactionByHash = function(hash, callback) {
  this.state.getTransactionReceipt(hash, function(err, receipt) {
    if (err) return callback(err);

    var result = null;

    if (receipt) {
      result = txhelper.toJSON(receipt.tx, receipt.block)
    }

    callback(null, result);
  });
}

GethApiDouble.prototype.eth_getTransactionCount = function(address, block_number, callback) {
  this.state.getTransactionCount(address, block_number, callback);
}

GethApiDouble.prototype.eth_sign = function(address, dataToSign, callback) {
    callback(null, this.state.sign(address, dataToSign));
};

GethApiDouble.prototype.eth_sendTransaction = function(tx_data, callback) {
  this.state.queueTransaction("eth_sendTransaction", tx_data, callback);
};

GethApiDouble.prototype.eth_sendRawTransaction = function(rawTx, callback) {
  this.state.queueRawTransaction(rawTx, callback);
};

GethApiDouble.prototype.eth_getStorageAt = function(address, position, block_number, callback) {
  this.state.queueStorage(address, position, block_number, callback);
}

GethApiDouble.prototype.eth_newBlockFilter = function(callback) {
  var filter_id = utils.addHexPrefix(utils.intToHex(this.state.latest_filter_id));
  this.state.latest_filter_id += 1;
  callback(null, filter_id);
};

GethApiDouble.prototype.eth_getFilterChanges = function(filter_id, callback) {
  var blockHash = this.state.latestBlock().hash().toString("hex");
  // Mine a block after each request to getFilterChanges so block filters work.
  this.state.mine();
  callback(null, [blockHash]);
};

GethApiDouble.prototype.eth_getLogs = function(filter, callback) {
  this.state.getLogs(filter, callback);
};

GethApiDouble.prototype.eth_uninstallFilter = function(filter_id, callback) {
  callback(null, true);
};

GethApiDouble.prototype.eth_getCompilers = function(callback) {
  callback(null, ["solidity"]);
}

GethApiDouble.prototype.eth_syncing = function(callback) {
  callback(null, false);
};

GethApiDouble.prototype.net_listening = function(callback) {
  callback(null, true);
};

GethApiDouble.prototype.net_peerCount = function(callback) {
  callback(null, 0);
};

GethApiDouble.prototype.web3_clientVersion = function(callback) {
  callback(null, "EthereumJS TestRPC/v" + pkg.version + "/ethereum-js")
};

GethApiDouble.prototype.web3_sha3 = function(string, callback) {
  callback(null, to.hex(utils.sha3(string)));
};

GethApiDouble.prototype.net_version = function(callback) {
  // net_version returns a string containing a base 10 integer.
  callback(null, this.state.net_version + "");
};

/* Functions for testing purposes only. */

GethApiDouble.prototype.evm_snapshot = function(callback) {
  callback(null, this.state.snapshot());
};

GethApiDouble.prototype.evm_revert = function(snapshot_id, callback) {
  callback(null, this.state.revert(snapshot_id));
};

GethApiDouble.prototype.evm_increaseTime = function(seconds, callback) {
  callback(null, this.state.blockchain.increaseTime(seconds));
};

GethApiDouble.prototype.evm_mine = function(callback) {
  this.state.blockchain.processNextBlock(function(err) {
    // Remove the VM result objects from the return value.
    callback(err);
  });
};



module.exports = GethApiDouble;
