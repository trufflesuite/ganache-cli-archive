var TestRPC = require("../");
var async = require("async");
var Web3 = require("web3");
var assert = require("chai").assert;

describe("Performance", function() {
  var provider;
  var accounts;
  var web3 = new Web3();

  before("create provider", function() {
    provider = TestRPC.provider();
    web3.setProvider(provider);
  });

  before("get accounts", function(done) {
    web3.eth.getAccounts(function(err, accs) {
      if (err) return done(err);
      accounts = accs;
      done();
    });
  });

  it("doesn't significantly change in speed", function(done) {
    this.timeout(20000);

    console.log("    Running short performance test...");

    var allowedDifference = 2000; // ms
    var expectedTime = 10000;
    var times = 1000;

    var start = new Date();

    async.timesSeries(times, function(n, next) {
      // We know transactions are mined instantly, so we don't need to check.
      web3.eth.sendTransaction({
        from: accounts[0],
        to: accounts[1],
        value: 500, // wei
        gas: 90000
      }, next);
    }, function(err) {
      if (err) return done(err);

      var end = new Date();
      var actualTime = end.getTime() - start.getTime();
      var difference = expectedTime - actualTime;

      console.log("    It took " + (actualTime / 1000) + " seconds");

      assert.isBelow(difference, allowedDifference, "Performance decreased!");
      assert.isAbove(difference, -allowedDifference, "Performance increased! Everything okay?");
      done();
    });


  });
});
