var Web3 = require('web3');
var utils = require('ethereumjs-util');
var assert = require('assert');
var TestRPC = require("../index.js");
var fs = require("fs");
var solc = require("solc");
var to = require("../lib/utils/to.js");
var async = require("async");

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
process.removeAllListeners("uncaughtException");

var logger = {
  log: function(msg) { /*noop*/ }
};

var source = fs.readFileSync("./test/Example2.sol", {encoding: "utf8"});
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

var forkedTargetUrl = "http://localhost:21345";

describe("Forking2", function() {
  var contractAddress;
  var contract2Address;
  var secondContractAddress; // used sparingly
  var forkedServer;
  var mainAccounts;
  var forkedAccounts;

  var initialFallbackAccountState = {};

  var forkedWeb3 = new Web3();
  var mainWeb3 = new Web3();

  var forkBlockNumber;

  var initialDeployTransactionHash;

  before("Initialize Fallback TestRPC server", function(done) {
    forkedServer = TestRPC.server({
      // Do not change seed. Determinism matters for these tests.
      seed: "let's make this deterministic",
      logger: logger
    });

    forkedServer.listen(21345, function(err) {
      if (err) return done(err);

      forkedWeb3.setProvider(new Web3.providers.HttpProvider(forkedTargetUrl));
      done();
    });
  });

  before("Gather forked accounts", function(done) { forkedWeb3.eth.getAccounts(function(err, f) {
      if (err) return done(err);
      forkedAccounts = f;
      done();
    });
  });

  before("Deploy initial contracts", function(done) {
    forkedWeb3.eth.sendTransaction({
      from: forkedAccounts[0],
      data: contract.binary
    }, function(err, tx) {
      if (err) { return done(err); }

      // Save this for a later test.
      initialDeployTransactionHash = tx;

      forkedWeb3.eth.getTransactionReceipt(tx, function(err, receipt) {
        if (err) return done(err);

        contractAddress = receipt.contractAddress;

        // Deploy a second one, which we won't use often.
        forkedWeb3.eth.sendTransaction({
          from: forkedAccounts[0],
          data: contract.binary
        }, function(err, tx) {
          if (err) { return done(err); }
          forkedWeb3.eth.getTransactionReceipt(tx, function(err, receipt) {
            if (err) return done(err);

            secondContractAddress = receipt.contractAddress;
            done();
          });
        });
      });
    });
  });

  before("Make a transaction on the forked chain that produces a log", function(done) {
    this.timeout(10000)

    var FallbackExample = forkedWeb3.eth.contract(JSON.parse(contract.abi));
    var forkedExample = FallbackExample.at(contractAddress);

    var interval;

    var event = forkedExample.ValueSet([{}]);

    function cleanup(err) {
      event.stopWatching();
      clearInterval(interval);
      done(err);
    }

    forkedExample.setValue(7, {from: forkedAccounts[0]}, function(err, tx) {
      if (err) return done(err);

      interval = setInterval(function() {
        event.get(function(err, logs) {
          if (err) return cleanup(err);

          if (logs.length == 0) return;

          assert(logs.length == 1);

          cleanup();
        });
      }, 500);
    });
  });

  before("Get initial balance and nonce", function(done) {
    async.parallel({
      balance: forkedWeb3.eth.getBalance.bind(forkedWeb3.eth, forkedAccounts[0]),
      nonce: forkedWeb3.eth.getTransactionCount.bind(forkedWeb3.eth, forkedAccounts[0])
    }, function(err, result) {
      if (err) return done(err);
      initialFallbackAccountState = result;
      initialFallbackAccountState.nonce = to.number(initialFallbackAccountState.nonce);
      done();
    });
  });

  var _provider;
  before('init provider async', function (done) {
    _provider = TestRPC.provider({
      fork: forkedTargetUrl,
      logger: logger,
      total_accounts: 5,
      // Do not change seed. Determinism matters for these tests.
      // seed: "a different seed"
      seed: "let's make this deterministic",
    });
    done();
  });

  before("Set main web3 provider, forking from forked chain at this point", function(done) {
    mainWeb3.setProvider(_provider);

    forkedWeb3.eth.getBlockNumber(function(err, number) {
      if (err) return done(err);
      forkBlockNumber = number;
      done();
    });
  });
  
  before("Deploy a Contract on the main chain which will use a contract on the forked chain.", (done) => {
    mainWeb3.eth.sendTransaction({
      from: forkedAccounts[0],
      data: "0x" + result.contracts.Example2.bytecode
    }, function(err, tx) {
      if (err) { return done(err); }

      mainWeb3.eth.getTransactionReceipt(tx, function(err, receipt) {
        if (err) return done(err);
        contract2Address = receipt.contractAddress;
        done();
      });
    });
  });

  before("Gather main accounts", function(done) {
    mainWeb3.eth.getAccounts(function(err, m) {
      if (err) return done(err);
      mainAccounts = m;
      done();
    });
  });

  after("Close down the forked TestRPC server", function(done){
    forkedServer.close();
    done();
  });

  it("should grab the correct value", function (done) {
    var Example2 = mainWeb3.eth.contract(JSON.parse(result.contracts.Example2.interface));
    var ex2 = Example2.at(contract2Address);

    ex2.getValueProxy.call(contractAddress, (err, res) => {
      if(err) return done(err);

      assert(res == 7);
      done();
    });
  });

});
