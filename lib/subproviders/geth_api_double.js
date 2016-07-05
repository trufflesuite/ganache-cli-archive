var utils = require('ethereumjs-util');
var fs = require('fs');
var async = require('async');
var inherits = require('util').inherits;
var BlockchainDouble = require('../blockchain_double.js');
var SolidityCompiler = require('../solidity_compiler.js');
var to = require('../utils/to');
var pkg = require('../../package.json');

var Subprovider = require('web3-provider-engine/subproviders/subprovider.js');

inherits(GethApiDouble, Subprovider)

function GethApiDouble(options) {
  this.blockchain = new BlockchainDouble(options);
  this.initialized = false;
  this.accounts = options.accounts;
  this.total_accounts = options.total_accounts || 10;
}

GethApiDouble.prototype.initialize = function(callback) {
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

GethApiDouble.prototype.waitForInitialization = function(callback) {
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
  callback(null, this.blockchain.accountAddresses());
};

GethApiDouble.prototype.eth_blockNumber = function(callback) {
  callback(null, to.hex(this.blockchain.blockNumber()));
};

GethApiDouble.prototype.eth_coinbase = function(callback) {
  callback(null, this.blockchain.coinbase);
};

GethApiDouble.prototype.eth_mining = function(callback) {
  callback(null, false);
};

GethApiDouble.prototype.eth_hashrate = function(callback) {
  callback(null, '0x0');
};

GethApiDouble.prototype.eth_gasPrice = function(callback) {
  callback(null, utils.addHexPrefix(this.blockchain.gasPrice()));
};

GethApiDouble.prototype.eth_getBalance = function(address, block_number, callback) {
  this.blockchain.getBalance(address, callback);
};

GethApiDouble.prototype.eth_getCode = function(address, block_number, callback) {
  this.blockchain.getCode(address, callback);
};

GethApiDouble.prototype.eth_getBlockByNumber = function(block_number, include_transactions, callback) {
  callback(null, this.blockchain.getBlockByNumber(block_number));
};

GethApiDouble.prototype.eth_getBlockByHash = function(tx_hash, include_transactions, callback) {
  callback(null, this.blockchain.getBlockByHash(tx_hash));
};

GethApiDouble.prototype.eth_getTransactionReceipt = function(tx_hash, callback) {
  callback(null, this.blockchain.getTransactionReceipt(tx_hash));
};

GethApiDouble.prototype.eth_getTransactionByHash = function(tx_hash, callback) {
  callback(null, this.blockchain.getTransactionByHash(tx_hash));
}

GethApiDouble.prototype.eth_getTransactionCount = function(address, block_number, callback) {
  this.blockchain.getTransactionCount(address, callback);
}

GethApiDouble.prototype.eth_sign = function(address, dataToSign, callback) {
    callback(null, this.blockchain.sign(address, dataToSign));
};

GethApiDouble.prototype.eth_sendTransaction = function(tx_data, callback) {
  this.blockchain.queueTransaction(tx_data, callback);
};

GethApiDouble.prototype.eth_sendRawTransaction = function(rawTx, callback) {
  this.blockchain.queueRawTransaction(rawTx, callback);
};

GethApiDouble.prototype.eth_getStorageAt = function(address, position, block_number, callback) {
  this.blockchain.queueStorage(address, position, block_number, callback);
}

GethApiDouble.prototype.eth_newBlockFilter = function(callback) {
  var filter_id = utils.addHexPrefix(utils.intToHex(this.blockchain.latest_filter_id));
  this.blockchain.latest_filter_id += 1;
  callback(null, filter_id);
};

GethApiDouble.prototype.eth_getFilterChanges = function(filter_id, callback) {
  var blockHash = this.blockchain.latestBlock().hash().toString("hex");
  // Mine a block after each request to getFilterChanges so block filters work.
  this.blockchain.mine();
  callback(null, [blockHash]);
};

GethApiDouble.prototype.eth_getLogs = function(filter, callback) {
  var logs = this.blockchain.getLogs(filter);
  callback(null, logs);
};

GethApiDouble.prototype.eth_uninstallFilter = function(filter_id, callback) {
  callback(null, true);
};

GethApiDouble.prototype.eth_getCompilers = function(callback) {
  callback(null, ["solidity"]);
}

GethApiDouble.prototype.eth_compileSolidity = function(code, callback) {
  var compiler = new SolidityCompiler();
  fs.writeFileSync("/tmp/solCompiler.sol", code);
  compiled = compiler.compile_solidity("/tmp/solCompiler.sol");
  callback(null, compiled);
};

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

GethApiDouble.prototype.net_version = function(callback) {
  // net_version returns a string containing a base 10 integer.
  callback(null, this.blockchain.net_version + "");
};

/* Functions for testing purposes only. */

GethApiDouble.prototype.evm_snapshot = function(callback) {
  callback(null, this.blockchain.snapshot());
};

GethApiDouble.prototype.evm_revert = function(snapshot_id, callback) {
  callback(null, this.blockchain.revert(snapshot_id));
};

module.exports = GethApiDouble;
