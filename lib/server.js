var rpc = require('json-rpc2-ethersim');
var Manager = require('./manager.js');
var Provider = require('./provider.js');
var manager = new Manager();
manager.resultOnly = true;

var server = rpc.Server.$create({
  'websocket': true,
  'headers': {
    'Access-Control-Allow-Origin': '*'
  }
});

function eth_accounts(args, opt, callback) {
  console.log("eth_accounts");
  manager.request({method: 'eth_accounts', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_blockNumber(args, opt, callback) {
  console.log("eth_blockNumber");
  manager.request({method: 'eth_blockNumber', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_call(args, opt, callback) {
  console.log("eth_call");
  manager.request({method: 'eth_call', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_coinbase(args, opt, callback) {
  console.log("eth_coinbase");
  manager.request({method: 'eth_coinbase', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_compileSolidity(args, opt, callback) {
  console.log("eth_compileSolidity");
  manager.request({method: 'eth_compileSolidity', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_gasPrice(args, opt, callback) {
  console.log("eth_gasPrice");
  manager.request({method: 'eth_gasPrice', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_getBalance(args, opt, callback) {
  console.log("eth_getBalance");
  manager.request({method: 'eth_getBalance', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_getBlockByNumber(args, opt, callback) {
  console.log("eth_getBlockByNumber");
  manager.request({method: 'eth_getBlockByNumber', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_getCompilers(args, opt, callback) {
  console.log("eth_getCompilers");
  console.log("not implemented");
}

function eth_getCode(args, opt, callback) {
  console.log("eth_getCode");
  manager.request({method: 'eth_getCode', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_getFilterChanges(args, opt, callback) {
  console.log("eth_getFilterChanges");
  //callback(null, ["0x123"]); // block number
  manager.request({method: 'eth_getFilterChanges', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_getTransactionByHash(args, opt, callback) {
  console.log("eth_getTransactionByHash");
  console.log("not implemented");
}

function eth_getTransactionCount(args, opt, callback) {
  console.log("eth_getTransactionCount");
  console.log("not implemented");
}

function eth_getTransactionReceipt(args, opt, callback) {
  console.log("eth_getTransactionReceipt");
  manager.request({method: 'eth_getTransactionReceipt', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_newBlockFilter(args, opt, callback) {
  console.log("eth_newBlockFilter");
  //callback(null, '0x0'); # no new block
  //callback(null, '0x123');
  manager.request({method: 'eth_newBlockFilter', params: args}, function(error, result) {
    callback(null, result);
  });
}

function eth_sendTransaction(args, opt, callback) {
  var json = args[0];
  console.log("eth_sendTransaction");
  result = manager.request({method: 'eth_sendTransaction', params: json});
  callback(null, result);
}

function eth_sendRawTransaction(args, opt, callback) {
  console.log("eth_sendRawTransaction");
  console.log("not implemented");
}

function eth_uninstallFilter(args, opt, callback) {
  console.log("eth_uninstallFilter");
  manager.request({method: 'eth_uninstallFilter', params: args}, function(error, result) {
    callback(null, result);
  });
}

function web3_sha3(args, opt, callback) {
  console.log("web3_sha3");
  console.log("not implemented");
}

function web3_clientVersion(args, opt, callback) {
  console.log("web3_clientVersion");
  console.log("not implemented");
}

Server = {
  startServer: function() {
    console.log("starting server...");
    server.expose('eth_accounts', eth_accounts);
    server.expose('eth_blockNumber', eth_blockNumber);
    server.expose('eth_call', eth_call);
    server.expose('eth_coinbase', eth_coinbase);
    server.expose('eth_compileSolidity', eth_compileSolidity);
    server.expose('eth_gasPrice', eth_gasPrice);
    server.expose('eth_getBalance', eth_getBalance);
    server.expose('eth_getBlockByNumber', eth_getBlockByNumber);
    server.expose('eth_getCompilers', eth_getCompilers);
    server.expose('eth_getCode', eth_getCode);
    server.expose('eth_getFilterChanges', eth_getFilterChanges);
    server.expose('eth_getTransactionByHash', eth_getTransactionByHash);
    server.expose('eth_getTransactionCount', eth_getTransactionCount);
    server.expose('eth_getTransactionReceipt', eth_getTransactionReceipt);
    server.expose('eth_newBlockFilter', eth_newBlockFilter);
    server.expose('eth_sendTransaction', eth_sendTransaction);
    server.expose('eth_sendRawTransaction', eth_sendRawTransaction);
    server.expose('eth_uninstallFilter', eth_uninstallFilter);
    server.expose('web3_sha3', web3_sha3);
    server.expose('web3_clientVersion', web3_clientVersion);

    server.listen(8101, 'localhost');
    console.log("listening on localhost:8101");
  }
}

module.exports = Server;
