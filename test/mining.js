var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');
var to = require("../lib/utils/to.js");

describe("Block Processing", function() {
  var web3 = new Web3(TestRPC.provider());
  var accounts;

  // Everything's a Promise to add in readibility.

  function getBlockNumber() {
    return new Promise(function(accept, reject) {
      web3.eth.getBlockNumber(function(err, number) {
        if (err) return reject(err);
        accept(to.number(number));
      });
    });
  };

  function startMining() {
    return new Promise(function(accept, reject) {
      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "miner_start",
        params: [1],
        id: new Date().getTime()
      }, function(err) {
        if (err) return reject(err);
        accept();
      });
    });
  }

  function stopMining() {
    return new Promise(function(accept, reject) {
      web3.currentProvider.sendAsync({
        jsonrpc: "2.0",
        method: "miner_stop",
        id: new Date().getTime()
      }, function(err) {
        if (err) return reject(err);
        accept();
      });
    });
  }

  function queueTransaction(from, to, gasLimit, value) {
    return new Promise(function(accept, reject) {
      web3.eth.sendTransaction({
        from: from,
        to: to,
        gas: gasLimit,
        value: value
      }, function(err, tx) {
        if (err) return reject(err);
        accept(tx);
      });
    })
  }

  function getReceipt(tx) {
    return new Promise(function(accept, reject) {
      web3.eth.getTransactionReceipt(tx, function(err, result) {
        if (err) return reject(err);
        accept(result);
      });
    });
  };

  before(function(done) {
    web3.eth.getAccounts(function(err, accs) {
      if (err) return done(err);
      accounts = accs;
      done();
    });
  });

  it("should mine a single block with two queued transactions", function() {
    var tx1, tx2, blockNumber;

    return stopMining().then(function() {
      return getBlockNumber();
    }).then(function(number) {
      blockNumber = number;
      return queueTransaction(accounts[0], accounts[1], 90000, web3.toWei(2, "Ether"));
    }).then(function(tx) {
      tx1 = tx;
      return getReceipt(tx);
    }).then(function(receipt) {
      assert.equal(receipt, null);

      return queueTransaction(accounts[0], accounts[1], 90000, web3.toWei(3, "Ether"));
    }).then(function(tx) {
      tx2 = tx;
      return getReceipt(tx);
    }).then(function(receipt) {
      assert.equal(receipt, null);

      return startMining();
    }).then(function() {
      return Promise.all([getReceipt(tx1), getReceipt(tx2)]);
    }).then(function(receipts) {
      assert.equal(receipts.length, 2);
      assert.notEqual(receipts[0], null);
      assert.equal(receipts[0].transactionHash, tx1);
      assert.notEqual(receipts[1], null);
      assert.equal(receipts[1].transactionHash, tx2);

      return getBlockNumber();
    }).then(function(number) {
      assert.equal(number, blockNumber + 1);
    });
  });

  it("should mine two blocks when two queued transactions won't fit into a single block", function() {
    // This is a very similar test to the above, except the gas limits are much higher
    // per transaction. This means the TestRPC will react differently and process
    // each transaction it its own block.

    var tx1, tx2, blockNumber;

    return stopMining().then(function() {
      return getBlockNumber();
    }).then(function(number) {
      blockNumber = number;
      return queueTransaction(accounts[0], accounts[1], 4000000, web3.toWei(2, "Ether"));
    }).then(function(tx) {
      tx1 = tx;
      return getReceipt(tx);
    }).then(function(receipt) {
      assert.equal(receipt, null);

      return queueTransaction(accounts[0], accounts[1], 4000000, web3.toWei(3, "Ether"));
    }).then(function(tx) {
      tx2 = tx;
      return getReceipt(tx);
    }).then(function(receipt) {
      assert.equal(receipt, null);

      return startMining();
    }).then(function() {
      return Promise.all([getReceipt(tx1), getReceipt(tx2)]);
    }).then(function(receipts) {
      assert.equal(receipts.length, 2);
      assert.notEqual(receipts[0], null);
      assert.equal(receipts[0].transactionHash, tx1);
      assert.notEqual(receipts[1], null);
      assert.equal(receipts[1].transactionHash, tx2);

      return getBlockNumber();
    }).then(function(number) {
      assert.equal(number, blockNumber + 2);
    });
  });

  it("should error if queued transaction exceeds the block gas limit", function(done) {
    return stopMining().then(function() {
      return queueTransaction(accounts[0], accounts[1], 5000000, web3.toWei(2, "Ether"));
    }).then(function(tx) {
      // It should never get here.
      return done(new Error("Transaction was processed without erroring; gas limit should have been too high"));
    }).catch(function(err) {
      // We caught an error like we expected. Ensure it's the right error, or rethrow.
      if (err.message.toLowerCase().indexOf("exceeds block gas limit") < 0) {
        return done(new Error("Did not receive expected error; instead received: " + err));
      }

      done();
    });
  });
});
