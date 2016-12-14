var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');
var tmp = require('tmp');
var fs = require("fs");
var solc = require("solc");

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

describe.skip("Persistency", function() {
  var web3 = new Web3();
  var provider;
  var cleanup;
  var accs;
  var path;
  var web3 = new Web3();

  // initialize a persistant provider
  before('init provider', function (done) {
    tmp.dir({ unsafeCleanup: true }, (err, _path, _cleanup) => {
      path = _path;
      cleanup = _cleanup;
      provider = TestRPC.provider({
        db_path: path,
        seed: "1337"
      });
      web3.setProvider(provider);
      done();
    });
  });

  before("Gather accounts", function(done) {
    web3.eth.getAccounts(function(err, a) {
      if (err) return done(err);
      accs = a;
      done();
    });
  });

  before("send transaction", function (done) {
    web3.eth.sendTransaction({
      from: accs[0],
      gas: '0x2fefd8',
      data: contract.binary
    }, done);
  });

  after('close provider', function (done) {
    cleanup();
    done();
  });

  it("should have block height 1", function (done) {
    web3.eth.getBlockNumber((err, res) => {
      assert(res == 1);
      done();
    });
  });

  it("should reopen the provider", function (done) {
    provider = TestRPC.provider({
      db_path: path,
      seed: "1337"
    });
    web3.setProvider(provider);
    done()
  });

  it("should still be on block height 1", function () {
    web3.eth.getBlockNumber((err, res) => {
      assert(res == 1);
      done();
    });
  });

});
