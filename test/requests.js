var Web3 = require('web3');
var Transaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');
var assert = require('assert');
var TestRPC = require("../index.js");

// Note: Certain properties of the following contract data are hardcoded to
// maintain repeatable tests. Most notably the compiled binary, ABI, and
// storage position of the "value" variable. As well, the tests below expect
// certain functions to be available in the contract. If you recompile the
// solidity code, included here for the reader, make sure to update the
// resulting contract data with the correct values.
var contract = {
  solidity: "contract Example { uint public value; function Example() {value = 5;} function setValue(uint val) {value = val;} }",
  abi: [{ "constant": true, "inputs": [], "name": "value", "outputs": [{ "name": "", "type": "uint256" }], "type": "function" }, { "constant": false, "inputs": [{ "name": "val", "type": "uint256" }], "name": "setValue", "outputs": [], "type": "function" }, { "inputs": [], "type": "constructor" }],
  binary: "0x6060604052600560005560408060156000396000f3606060405260e060020a60003504633fa4f245811460245780635524107714602c575b005b603660005481565b6004356000556022565b6060908152602090f3",
  position_of_value: "0x0000000000000000000000000000000000000000000000000000000000000000",
  expected_default_value: 5,
  call_data: {
    gas: '0x2fefd8',
    gasPrice: '0x01', // This is important, as passing it has exposed errors in the past.
    to: null, // set by test
    data: '0x3fa4f245'
  },
  transaction_data: {
    from: null, // set by test
    gas: '0x2fefd8',
    to: null, // set by test
    data: '0x552410770000000000000000000000000000000000000000000000000000000000000019' // sets value to 25 (base 10)
  }
};


var tests = function(web3) {
  var accounts;

  before(function(done) {
    web3.eth.getAccounts(function(err, accs) {
      if (err) return done(err);

      accounts = accs;
      done();
    });
  });

  describe("eth_accounts", function() {
    it("should return 10 addresses", function(done) {
      assert.deepEqual(accounts.length, 10);
      done();
    });
  });

  describe("eth_blockNumber", function() {
    it("should return initial block number of zero", function(done) {
      var number = web3.eth.getBlockNumber(function(err, result) {
        if (err) return done(err);

        assert.deepEqual(result, 0);
        done();
      });

      // Note: We'll assert the block number changes on transactions.
    });
  });

  describe("eth_coinbase", function() {
    it("should return correct address", function(done) {
      web3.eth.getCoinbase(function(err, coinbase) {
        if (err) return done(err);

        assert.deepEqual(coinbase, accounts[0]);
        done();
      });
    });
  });

  describe("eth_mining", function() {
    it("should return false", function(done) {
      web3.eth.getMining(function(err, result) {
        if (err) return done(err);

        assert.deepEqual(result, false);
        done();
      });
    });
  });

  describe("eth_hashrate", function() {
    it("should return hashrate of zero", function(done) {
      web3.eth.getHashrate(function(err, result) {
        if (err) return done(err);

        assert.deepEqual(result, 0);
        done();
      });
    });
  });

  describe("eth_gasPrice", function() {
    it("should return gas price of 1", function(done) {
      web3.eth.getGasPrice(function(err, result) {
        if (err) return done(err);

        assert.deepEqual(result.toNumber(), 1);
        done();
      });
    });
  });

  describe("eth_getBalance", function() {
    it("should return initial balance", function(done) {
      web3.eth.getBalance(accounts[0], function(err, result) {
        if (err) return done(err);

        assert.deepEqual("0x" + result.toString(16), "0xffffffffffffff00000000000000001");
        done();
      });
    });

    it("should return 0 for non-existent account", function(done) {
      web3.eth.getBalance("0x1234567890123456789012345678901234567890", function(err, result) {
        if (err) return done(err);

        assert.equal("0x" + result.toString(16), "0x0");
        done();
      });
    });
  });

  describe("eth_getBlockByNumber", function() {
    it("should return block given the block number", function(done) {
      web3.eth.getBlock(0, function(err, block) {
        if (err) return done(err);

        var expectedFirstBlock = {
          number: 0,
          hash: block.hash, // Don't test this one
          parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
          nonce: '0x0',
          sha3Uncles: '0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347',
          logsBloom: '0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
          transactionsRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
          stateRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
          receiptRoot: '0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421',
          miner: '0x0000000000000000000000000000000000000000',
          difficulty: { s: 1, e: 0, c: [ 0 ] },
          totalDifficulty: { s: 1, e: 0, c: [ 0 ] },
          extraData: '0x0',
          size: 1000,
          gasLimit: 3141592,
          gasUsed: 0,
          timestamp: block.timestamp, // Don't test this one.
          transactions: [],
          uncles: []
        };

        assert.deepEqual(block, expectedFirstBlock);

        var now = (new Date()).getTime();
        var then = block.timestamp * 1000; // block.timestamp is in seconds.

        assert.equal(then.toString().length, now.toString().length, "Invalid timestamp length");
        assert(then < now, "Time returned was greater than the current time");
        done();
      });
    });
  });

  // Relies on the validity of eth_getBlockByNumber above.
  describe("eth_getBlockByHash", function() {
    it("should return block given the block hash", function(done) {
      web3.eth.getBlock(0, function(err, blockByNumber) {
        if (err) return done(err);

        web3.eth.getBlock(blockByNumber.hash, function(err, blockByHash) {
          if (err) return done(err);

          assert.deepEqual(blockByHash, blockByNumber);
          done();
        });
      });
    });
  });

  describe("eth_sign", function() {
  	it("should produce a signature whose signer can be recovered", function(done) {
  	  var msg = web3.sha3("asparagus");
  	  sgn = web3.eth.sign(accounts[0], msg, function(err, sgn) {

      if (err) return done(err);

  	  sgn = utils.stripHexPrefix(sgn);
  		var r = new Buffer(sgn.slice(0, 64), 'hex');
  		var s = new Buffer(sgn.slice(64, 128), 'hex');
  		var v = new Buffer(sgn.slice(128, 130), 'hex');
  		var pub = utils.ecrecover(new Buffer(msg, 'hex'), v, r, s);
  		var addr = utils.setLength(utils.fromSigned(utils.pubToAddress(pub)), 20);
  		addr = utils.addHexPrefix(addr.toString('hex'));
  		assert.deepEqual(addr, accounts[0]);
  		done();
  	    });
  	});
  });


  describe("contract scenario", function() {

    // These are expected to be run in order.
    var initialTransaction;
    var contractAddress;

    it("should add a contract to the network (eth_sendTransaction)", function(done) {
      web3.eth.sendTransaction({
        from: accounts[0],
        data: contract.binary
      }, function(err, result) {
        if (err) return done(err);

        initialTransaction = result;
        assert.deepEqual(initialTransaction.length, 66);
        done();
      });
    });

    it("should verify the transaction immediately (eth_getTransactionReceipt)", function(done) {
      web3.eth.getTransactionReceipt(initialTransaction, function(err, receipt) {
        if (err) return done(err);

        contractAddress = receipt.contractAddress;

        assert.notEqual(receipt, null, "Transaction receipt shouldn't be null");
        assert.notEqual(contractAddress, null, "Transaction did not create a contract");
        done();
      });
    });

    it("should verify there's code at the address (eth_getCode)", function(done) {
      web3.eth.getCode(contractAddress, function(err, result) {
        if (err) return done(err);
        assert.notEqual(result, null);
        assert.notEqual(result, "0x");

        // NOTE: We can't test the code returned is correct because the results
        // of getCode() are *supposed* to be different than the code that was
        // added to the chain.

        done();
      });
    });

    it("should be able to read data via a call (eth_call)", function(done) {
      var call_data = contract.call_data;
      call_data.to = contractAddress;
      call_data.from = accounts[0];

      var starting_block_number = null;

      // TODO: Removing this callback hell would be nice.
      web3.eth.getBlockNumber(function(err, result) {
        if (err) return done(err);

        starting_block_number = result;

        web3.eth.call(call_data, function(err, result) {
          if (err) return done(err);
          assert.equal(web3.toDecimal(result), 5);

          web3.eth.getBlockNumber(function(err, result) {
            if (err) return done(err);

            assert.equal(result, starting_block_number, "eth_call increased block count when it shouldn't have");
            done();
          });
        });
      });
    });

    it("should be able to make a call from an address not in the accounts list (eth_call)", function(done) {
      var from = "0x1234567890123456789012345678901234567890";

      // Assert precondition: Ensure from address isn't in the accounts list.
      accounts.forEach(function(account) {
        assert.notEqual(from, account, "Test preconditions not met: from address must not be within the accounts list, please rerun");
      });

      var call_data = contract.call_data;
      call_data.to = contractAddress;
      call_data.from = from;

      web3.eth.call(call_data, function(err, result) {
        if (err) return done(err);
        assert.equal(web3.toDecimal(result), 5);

        done();
      });
    });

    it("should be able to make a call when no address is listed (eth_call)", function(done) {
      var call_data = contract.call_data;
      call_data.to = contractAddress;
      delete call_data.from;

      web3.eth.call(call_data, function(err, result) {
        if (err) return done(err);
        assert.equal(web3.toDecimal(result), 5);

        done();
      });
    });

    it("should be able to estimate gas of a transaction (eth_estimateGas)", function(done){
      var tx_data = contract.transaction_data;
      tx_data.to = contractAddress;
      tx_data.from = accounts[0];

      var starting_block_number = null;

      // TODO: Removing this callback hell would be nice.
      web3.eth.getBlockNumber(function(err, result) {
        if (err) return done(err);

        starting_block_number = result;

        web3.eth.estimateGas(tx_data, function(err, result) {
          if (err) return done(err);
          assert.equal(result, 26585);

          web3.eth.getBlockNumber(function(err, result) {
            if (err) return done(err);

            assert.equal(result, starting_block_number, "eth_estimateGas increased block count when it shouldn't have");
            done();
          });
        });
      });
    });

    it("should be able to estimate gas from an account not within the accounts list (eth_estimateGas)", function(done){
      var tx_data = contract.transaction_data;
      tx_data.to = contractAddress;
      tx_data.from = "0x1234567890123456789012345678901234567890";;

      var starting_block_number = null;

      web3.eth.estimateGas(tx_data, function(err, result) {
        if (err) return done(err);
        assert.equal(result, 26585);
        done();
      });
    });

    it("should be able to estimate gas when no account is listed (eth_estimateGas)", function(done){
      var tx_data = contract.transaction_data;
      tx_data.to = contractAddress;
      delete tx_data.from;

      var starting_block_number = null;

      web3.eth.estimateGas(tx_data, function(err, result) {
        if (err) return done(err);
        assert.equal(result, 26585);
        done();
      });
    });

    it("should be able to send a state changing transaction (eth_sendTransaction)", function(done) {
      var tx_data = contract.transaction_data;
      tx_data.to = contractAddress;
      tx_data.from = accounts[0];

      var call_data = contract.call_data;
      call_data.from = accounts[0];
      call_data.to = contractAddress;

      web3.eth.sendTransaction(tx_data, function(err, result) {
        if (err) return done(err);
        // Now double check the data was set properly.
        // NOTE: Because ethereumjs-testrpc processes transactions immediately,
        // we can do this. Calling the call immediately after the transaction would
        // fail on a different Ethereum client.

        //console.log(call_data);
        web3.eth.call(call_data, function(err, result) {
          if (err) return done(err);

          assert.equal(web3.toDecimal(result), 25);
          done();
        });
      });
    });

    it("should only be able to send an unsigned state changing transaction from an address within the accounts list (eth_sendTransaction)", function(done) {
      var badAddress = "0x1234567890123456789012345678901234567890";

      var tx_data = {};
      tx_data.to = "0x1111111111000000000011111111110000000000";
      tx_data.from = badAddress;
      tx_data.value = "0x1";

      web3.eth.sendTransaction(tx_data, function(err, result) {
        if (err) {
          assert.notEqual(err.message.indexOf("could not unlock signer account"), -1);
          done();
        } else {
          assert.fail("Should have received an error")
        }
      });
    });

    it("should get the data from storage (eth_getStorageAt)", function(done) {
      web3.eth.getStorageAt(contractAddress, contract.position_of_value, function(err, result) {
        assert.equal(web3.toDecimal(result), 25);
        done();
      });
    });

  });

  describe("contract scenario (raw tx)", function() {

    var tx = new Transaction({
      data: contract.binary,
    })
    var privateKey = new Buffer('e331b6d69882b4cb4ea581d88e0b604039a3de5967688d3dcffdd2270c0fd109', 'hex')
    var senderAddress = '0x'+utils.privateToAddress(privateKey).toString('hex')
    tx.sign(privateKey)
    var rawTx = '0x'+tx.serialize().toString('hex')

    // These are expected to be run in order.
    var initialTransaction;
    var contractAddress;

    it("should first populate senders address", function(done) {
      // populate senders balance
      web3.eth.sendTransaction({
        from: accounts[0],
        to: senderAddress,
        value: '0x3141592',
      }, function(err, result) {
        if (err) return done(err);
        done();
      });
    });

    it("should add a contract to the network (eth_sendRawTransaction)", function(done) {
      web3.eth.sendRawTransaction(rawTx, function(err, result) {
        if (err) return done(err);
        initialTransaction = result;
        done();
      });
    });

    it("should verify the transaction immediately (eth_getTransactionReceipt)", function(done) {
      web3.eth.getTransactionReceipt(initialTransaction, function(err, receipt) {
        if (err) return done(err);

        contractAddress = receipt.contractAddress;

        assert.notEqual(receipt, null, "Transaction receipt shouldn't be null");
        assert.notEqual(contractAddress, null, "Transaction did not create a contract");
        done();
      });
    });

    it("should verify there's code at the address (eth_getCode)", function(done) {
      web3.eth.getCode(contractAddress, function(err, result) {
        if (err) return done(err);
        assert.notEqual(result, null);
        assert.notEqual(result, "0x");

        // NOTE: We can't test the code returned is correct because the results
        // of getCode() are *supposed* to be different than the code that was
        // added to the chain.

        done();
      });
    });

  });

  describe("eth_getTransactionByHash", function() {
    it("should return transaction"); //, function() {
  });

  describe("eth_getTransactionCount", function() {
    //it("should return number of transactions sent from an address"); //, function() {

    it("should return 0 for non-existent account", function(done) {
      web3.eth.getTransactionCount("0x1234567890123456789012345678901234567890", function(err, result) {
        if (err) return done(err);

        assert.equal(result, "0x0");
        done();
      });
    });
  });
};

var logger = {
  log: function(message) {
    //console.log(message);
  }
};

describe("Provider:", function() {
  var web3 = new Web3();
  web3.setProvider(TestRPC.provider({
    logger: logger
  }));
  tests(web3);
});

describe("Server:", function(done) {
  var web3 = new Web3();
  var port = 12345;
  var server;

  before("Initialize TestRPC server", function(done) {
    server = TestRPC.server({
      logger: logger
    });
    server.listen(port, function() {
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      done();
    });
  });

  after("Shutdown server", function(done) {
    server.close(done);
  });

  tests(web3);
});
