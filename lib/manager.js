var Blockchain = require('./blockchain.js');
var Compiler = require('./compiler.js');
var utils = require('ethereumjs-util');
var fs = require('fs');

var value = "0x0";

//TODO: remove this
firstTime = true;

sleep = function sleep(ms) {
  var start = new Date().getTime();
  while (new Date().getTime() < start + ms);
}

Manager = function () {
  this.blockchain = new Blockchain();
  this.blockchain.addAccount();
  this.blockchain.addBlock();
  this.resultOnly = false;
}

Manager.prototype.response = function(params, result) {
  if (this.resultOnly) {
    return result;
  }
  else {
    return {"id":params.id,"jsonrpc":"2.0","result":result};
  } 
}

Manager.prototype.responseMultiple = function(params, result) {
  if (this.resultOnly) {
    return result;
  }
  else {
    return [{"id":params.id,"jsonrpc":"2.0","result":result}];
  }
}

Manager.prototype.request = function(params, cb) {
  var result;
  switch (params.method || params[0].method) {
    case 'eth_accounts':
      result = this.response(params, this.blockchain.accountAddresses());
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_blockNumber':
      result = this.response(params, '0x' + utils.intToHex(this.blockchain.blockNumber));
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_coinbase':
      result = this.response(params, this.coinbase());
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_mining':
      return this.response(params, false);
    case 'eth_hashrate':
      return this.response(params, '0x' + utils.intToHex(0));
    case 'eth_gasPrice':
      result = this.response(params, '0x' + this.blockchain.gasPrice());
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getBalance':
      result = this.response(params, '0x' + this.blockchain.balanceOf(params.params[0]));
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getStorageAt':
      throw Error("eth_getStorageAt not implemented");
    case 'eth_getCode':
      result = this.response(params, this.blockchain.getCode(params.params[0]));
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getBlockByNumber':
      result = this.response(params, this.blockchain.getBlockByNumber(params.params[0]));
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getBlockByHash':
      return this.response(params, this.blockchain.getBlockByHash(params.params[0]));
    case 'eth_getBlockTransactionCountByNumber':
      throw Error("eth_getBlockTransactionCountByNumber not implemented");
    case 'eth_getBlockTransactionCountByHash':
      throw Error("eth_getBlockTransactionCountByHash not implemented");
    case 'eth_getBlockTransactionCountByHash':
      throw Error("eth_getBlockTransactionCountByHash not implemented");
    case 'eth_getUncleByBlockNumberAndIndex':
      throw Error("eth_getUncleByBlockNumberAndIndex not implemented");
    case 'eth_getUncleByBlockHashAndIndex':
      throw Error("eth_getUncleByBlockHashAndIndex not implemented");
    case 'eth_getTransactionByHash':
      throw Error("eth_getTransactionByHash not implemented");
    case 'eth_getTransactionByBlockNumberAndIndex':
      throw Error("eth_getTransactionByBlockNumberAndIndex not implemented");
    case 'eth_getTransactionByBlockHashAndIndex':
      throw Error("eth_getTransactionByBlockHashAndIndex not implemented");
    case 'eth_getTransactionReceipt':
      result = this.response(params, this.blockchain.getReceipt(params.params[0]));
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getTransactionCount':
      throw Error("eth_getTransactionCount not implemented");
    case 'eth_sendTransaction':
      var _this = this;
      var block = this.blockchain.latestBlock();
      var transaction = new Transaction(params.params);

      transaction.run(block, function(result) {
        if (cb !== undefined) {
          cb(null, _this.response(params, transaction.hash));
        }
      });

      return this.response(params, transaction.hash);
    case 'eth_call':
      var _this = this;
      var block = this.blockchain.latestBlock();
      var transaction = new Transaction(params.params[0]);

      transaction.run(block, function(result) {
        cb(null, _this.response(params, result.result));
      });

      return this.response(params, "0x0");
    case 'eth_newBlockFilter':
      result = this.response(params, "0x1");
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_getFilterChanges':

      var blockHash = this.blockchain.latestBlock().hash();

      //TODO: remove this
      if (firstTime) {
        firstTime = false;
        if (cb !== undefined) {
          cb(null, this.responseMultiple(params[0], []));
        }
        return this.responseMultiple(params[0], []);
      }

      if (cb !== undefined) {
        cb(null, this.responseMultiple(params[0], [blockHash]));
      }
      return this.responseMultiple(params[0], [blockHash]);
    case 'eth_uninstallFilter':
      result = true;
      if (cb !== undefined) cb(null, result);
      return result;
    case 'eth_compileSolidity':
      var compiler = new Compiler();
      fs.writeFileSync("/tmp/solCompiler.sol", params.params[0]);
      compiled = compiler.compile_solidity("/tmp/solCompiler.sol");
      result = this.response(params, compiled);
      if (cb !== undefined) cb(null, compiled);
      return result;
    default:
      console.log("not implemented!");
      console.log(params);
  }
}

Manager.prototype.mine = function() {
  this.blockchain.addBlock();
}

Manager.prototype.coinbase = function() {
  return this.blockchain.accountAddresses()[0];
}

module.exports = Manager;
