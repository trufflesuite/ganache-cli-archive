var Web3 = require('web3');
var utils = require('ethereumjs-util');
var assert = require('assert');
var TestRPC = require("../../index.js");
var fs = require("fs");
var solc = require("solc");
var BlockchainDouble = require('../../lib/blockchain_double.js');

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

  before("Initialize Fallback TestRPC server", function(done) {
    var web3 = new Web3();

    fallbackServer = TestRPC.server({
      logger: logger
    });

    fallbackServer.listen(21345, function() {
      web3.setProvider(new Web3.providers.HttpProvider(fallbackTargetUrl));

      // Deploy the test contract into the fallback testrpc
      web3.eth.getAccounts(function(err, accounts) {
        if (err) return done(err);

        web3.eth.sendTransaction({
          from: accounts[0],
          data: contract.binary
        }, function(err, tx) {
          if (err) { return done(err); }
          web3.eth.getTransactionReceipt(tx, function(err, receipt) {
            if (err) return done(err);

            contractAddress = receipt.contractAddress;
            done();
          });
        });
      });
    });
  });

  after("Close down the fallback TestRPC server", function(done){
    fallbackServer.close();
    done();
  });

  it("should fetch a contract from the fallback when called and not present in the testrpc", function(done) {
    var web3   = new Web3();
    var server = TestRPC.server({fallback: fallbackTargetUrl, logger: logger});
    var port   = 21346;

    server.listen(port, function() {
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      web3.eth.getCode(contractAddress, function(err, result) {
        if (err) return done(err);
        assert.notEqual(result, null);
        assert.notEqual(result, "0x");

        server.close(done);
      });
    });
  });

  it("should have a copy of the contract locally after being fetched", function(done){
    var web3       = new Web3();
    var blockchain = new BlockchainDouble();
    var server     = TestRPC.server({fallback: fallbackTargetUrl, logger: logger, blockchain: blockchain});
    var port       = 21346;

    server.listen(port, function() {
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      web3.eth.getCode(contractAddress, function(err, result) {
        if (err) return done(err);

        blockchain.hasContractCode( contractAddress, function( err, result ) {
          if(err) done(err);
          assert.equal( result, true );
          server.close(done);
        });
      });
    });

  });
});
