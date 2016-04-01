var Blockchain = require('./blockchain.js');
var Compiler = require('./compiler.js');
var utils = require('ethereumjs-util');
var fs = require('fs');
var async = require('async');
var pkg = require('../package.json');
var inherits = require('util').inherits;

var Subprovider = require('web3-provider-engine/subproviders/subprovider.js');

inherits(Manager, Subprovider)

function Manager(options) {
  this.blockchain = new Blockchain(options);
  this.initialized = false;
  this.accounts = options.accounts;
  this.total_accounts = options.total_accounts || 10;
}

Manager.prototype.initialize = function(callback) {
  var self = this;

  if (this.accounts) {
    async.each(this.accounts, function(account, next) {
      self.blockchain.addAccount(account, next);
    }, function() {
      self.initialized = true;
    });
  } else {
    // Add 10 accounts, for testing purposes.
    async.timesSeries(this.total_accounts, function(n, next) {
      self.blockchain.addAccount({}, next);
    }, function() {
      self.initialized = true;
    });
  }
};

Manager.prototype.waitForInitialization = function(callback) {
  var self = this;
  if (this.initialized == false) {
    setTimeout(function() {
      self.waitForInitialization(callback);
    }, 100);
  } else {
    callback(null, this.blockchain);
  }
}

// Function to not pass methods through until initialization is finished
Manager.prototype.handleRequest = function(payload, next, end) {
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

Manager.prototype.getDelayedHandler = function(payload, next, end) {
  var self = this;
  return function() {
    self.handleRequest(payload, next, end);
  }
}

Manager.prototype.requiresDefaultBlockParameter = function(method) {
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

Manager.prototype.eth_accounts = function(callback) {
  callback(null, this.blockchain.accountAddresses());
};

Manager.prototype.eth_blockNumber = function(callback) {
  callback(null, this.blockchain.toHex(this.blockchain.blockNumber()));
};

Manager.prototype.eth_coinbase = function(callback) {
  callback(null, this.blockchain.coinbase);
};

Manager.prototype.eth_mining = function(callback) {
  callback(null, false);
};

Manager.prototype.eth_hashrate = function(callback) {
  callback(null, '0x0');
};

Manager.prototype.eth_gasPrice = function(callback) {
  callback(null, utils.addHexPrefix(this.blockchain.gasPrice()));
};

Manager.prototype.eth_getBalance = function(address, block_number, callback) {
  this.blockchain.getBalance(address, callback);
};

Manager.prototype.eth_getCode = function(address, block_number, callback) {
  this.blockchain.getCode(address, callback);
};

Manager.prototype.eth_getBlockByNumber = function(block_number, include_transactions, callback) {
  callback(null, this.blockchain.getBlockByNumber(block_number));
};

Manager.prototype.eth_getBlockByHash = function(tx_hash, include_transactions, callback) {
  callback(null, this.blockchain.getBlockByHash(tx_hash));
};

Manager.prototype.eth_getTransactionReceipt = function(tx_hash, callback) {
  callback(null, this.blockchain.getTransactionReceipt(tx_hash));
};

Manager.prototype.eth_getTransactionByHash = function(tx_hash, callback) {
  callback(null, this.blockchain.getTransactionByHash(tx_hash));
}

Manager.prototype.eth_getTransactionCount = function(address, block_number, callback) {
  this.blockchain.getTransactionCount(address, callback);
}

Manager.prototype.eth_sign = function(address, dataToSign, callback) {
    callback(null, this.blockchain.sign(address, dataToSign));
};

Manager.prototype.eth_sendTransaction = function(tx_data, callback) {
  this.blockchain.queueTransaction(tx_data, callback);
};

Manager.prototype.eth_sendRawTransaction = function(rawTx, callback) {
  this.blockchain.queueRawTransaction(rawTx, callback);
};

Manager.prototype.eth_getStorageAt = function(address, position, block_number, callback) {
  this.blockchain.queueStorage(address, position, block_number, callback);
}

Manager.prototype.eth_newBlockFilter = function(callback) {
  var filter_id = utils.addHexPrefix(utils.intToHex(this.blockchain.latest_filter_id));
  this.blockchain.latest_filter_id += 1;
  callback(null, filter_id);
};

Manager.prototype.eth_getFilterChanges = function(filter_id, callback) {
  var blockHash = this.blockchain.latestBlock().hash().toString("hex");
  // Mine a block after each request to getFilterChanges so block filters work.
  this.blockchain.mine();
  callback(null, [blockHash]);
};

Manager.prototype.eth_getLogs = function(filter, callback) {
  var logs = this.blockchain.getLogs(filter);
  callback(null, logs);
};

Manager.prototype.eth_uninstallFilter = function(filter_id, callback) {
  callback(null, true);
};

Manager.prototype.eth_getCompilers = function(callback) {
  callback(null, ["solidity"]);
}

Manager.prototype.eth_compileSolidity = function(code, callback) {
  var compiler = new Compiler();
  fs.writeFileSync("/tmp/solCompiler.sol", code);
  compiled = compiler.compile_solidity("/tmp/solCompiler.sol");
  callback(null, compiled);
};

Manager.prototype.net_listening = function(callback) {
  callback(null, true);
};

Manager.prototype.web3_clientVersion = function(callback) {
  callback(null, "EthereumJS TestRPC/v" + pkg.version + "/ethereum-js")
};

/* Functions for testing purposes only. */

Manager.prototype.evm_snapshot = function(callback) {
  callback(null, this.blockchain.snapshot());
};

Manager.prototype.evm_revert = function(snapshot_id, callback) {
  callback(null, this.blockchain.revert(snapshot_id));
};

module.exports = Manager;
