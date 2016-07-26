var Web3 = require('web3');
var utils = require('ethereumjs-util');
var assert = require('assert');
var TestRPC = require("../../index.js");
var fs = require("fs");
var solc = require("solc");
var BlockchainDouble = require('../../lib/blockchain_double.js');

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
process.removeAllListeners("uncaughtException");

var logger = {
  log: function(msg) { /*noop*/ }
};

var source = fs.readFileSync("./test/Example.sol", {encoding: "utf8"});
var result = solc.compile(source, 1);

// Note: Certain properties of the following contract data are hardcoded to
// maintain repeatable tests. If you significantly change the solidity code,
// make sure to update the resulting contract data with the correct values.
var contract = {
  solidity: source,
  abi: result.contracts.Example.interface,
  binary: "0x" + result.contracts.Example.bytecode,
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

var fallbackTargetUrl = "http://localhost:21345";

describe("Contract Fallback", function() {
  var contractAddress;
  var fallbackServer;
  var coinbaseAccount;
  var mainAccounts;
  var fallbackAccounts;

  var fallbackWeb3 = new Web3();
  var mainWeb3 = new Web3();

  before("Initialize Fallback TestRPC server", function(done) {
    fallbackServer = TestRPC.server({
      seed: "let's make this deterministic",
      logger: logger
    });

    fallbackServer.listen(21345, function() {
      fallbackWeb3.setProvider(new Web3.providers.HttpProvider(fallbackTargetUrl));

      // Deploy the test contract into the fallback testrpc
      fallbackWeb3.eth.getAccounts(function(err, accounts) {
        if (err) return done(err);

        coinbaseAccount = accounts[0];

        fallbackWeb3.eth.sendTransaction({
          from: coinbaseAccount,
          data: contract.binary
        }, function(err, tx) {
          if (err) { return done(err); }
          fallbackWeb3.eth.getTransactionReceipt(tx, function(err, receipt) {
            if (err) return done(err);

            contractAddress = receipt.contractAddress;
            done();
          });
        });
      });
    });
  });

  before("Set main web3 provider", function() {
    mainWeb3.setProvider(TestRPC.provider({
      fallback: fallbackTargetUrl,
      logger: logger,
      seed: "a different seed"
    }));
  });

  before("Gather accounts", function(done) {
    mainWeb3.eth.getAccounts(function(err, m) {
      if (err) return done(err);

      fallbackWeb3.eth.getAccounts(function(err, f) {
        mainAccounts = m;
        fallbackAccounts = f;

        done();
      });
    });
  });

  after("Close down the fallback TestRPC server", function(done){
    fallbackServer.close();
    done();
  });

  it("should fetch a contract from the fallback via the main provider", function(done) {
    mainWeb3.eth.getCode(contractAddress, function(err, mainCode) {
      if (err) return done(err);

      console.log(mainCode);

      // Ensure there's *something* there.
      assert.notEqual(result, null);
      assert.notEqual(result, "0x");
      assert.notEqual(result, "0x0");

      // Now make sure it matches exactly.
      fallbackWeb3.eth.getCode(contractAddress, function(err, fallbackCode) {
        if (err) return done(err);

        assert.equal(mainCode, fallbackCode);
        done();
      });
    });
  });

  it("should be able to get the balance of an address in the fallback provider via the main provider", function(done) {
    // Assert preconditions
    var first_fallback_account = fallbackAccounts[0];
    assert(mainAccounts.indexOf(first_fallback_account) < 0);

    // Now for the real test: Get the balance of a fallback account through the main provider.
    mainWeb3.eth.getBalance(first_fallback_account, function(err, balance) {
      // We don't assert the exact balance as transactions cost eth
      assert(balance > 999999);
      done();
    });
  });

  it("should be able to get storage values on the fallback provider via the main provider", function(done) {
    mainWeb3.eth.getStorageAt(contractAddress, contract.position_of_value, function(err, result) {
      if (err) return done(err);
      assert.equal(mainWeb3.toDecimal(result), 5);
      done();
    });
  });

  it("should be able to execute calls against a contract on the fallback provider via the main provider", function(done) {
    var Example = mainWeb3.eth.contract(JSON.parse(contract.abi));
    var example = Example.at(contractAddress);

    example.value({from: mainAccounts[0]}, function(err, result){
      if (err) return done(err);
      assert.equal(mainWeb3.toDecimal(result), 5);

      // Make the call again to ensure caches updated and the call still works.
      example.value({from: mainAccounts[0]}, function(err, result){
        if (err) return done(err);
        assert.equal(mainWeb3.toDecimal(result), 5);
        done(err);
      });
    });
  });

  it.only("should be able to make a transaction on the main provider while not transacting on the fallback provider", function(done) {
    var Example = mainWeb3.eth.contract(JSON.parse(contract.abi));
    var example = Example.at(contractAddress);

    example.setValue(25, {from: mainAccounts[0]}, function(err) {
      if (err) return done(err);

      console.log("getting value");
      // It insta-mines, so we can make a call directly after.
      example.value({from: mainAccounts[0]}, function(err, result){
        if (err) return done(err);
        assert.equal(mainWeb3.toDecimal(result), 5);
        done(err);
      });
    })
  });
});
