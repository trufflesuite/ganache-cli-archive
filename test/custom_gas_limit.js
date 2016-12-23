var Web3 = require('web3');
var assert = require('assert');
var TestRPC = require("../index.js");

describe("Custom Gas Limit", function() {
  var web3;
  var provider;

  before("Init the Web3 provider", function(done){
    web3 = new Web3();
    provider = TestRPC.provider({
      gasLimit: 5000000
    });
    web3.setProvider(provider);
    done();
  });

  it("The block should show the correct custom Gas Limit", function(done) {
    web3.eth.getBlock(0, function(err, block) {
      if (err) return done(err);
      assert.deepEqual(block.gasLimit, 5000000);
      done();
    });
  });
});
