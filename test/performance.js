var TestRPC = require("../");
var async = require("async");
var Web3 = require("web3");

describe("performance", function() {
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
    this.timeout(10000);

    var allowedDifference = 3000; // ms
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

      console.log("It took " + ((end.getTime() - start.getTime()) / 1000) + " seconds");
      done();
    });


  });
});
