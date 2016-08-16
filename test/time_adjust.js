var TestRPC = require("../index.js");
var assert = require('assert');
var Web3 = require("web3");

describe('Time adjustment', function(){
  var provider = TestRPC.provider()
  var web3 = new Web3(provider);
  var secondsToJump = 5 * 60 * 60;

  var timestampBeforeJump;

  function send(method, params, callback) {
    if (typeof params == "function") {
      callback = params;
      params = [];
    }

    provider.sendAsync({
      jsonrpc: "2.0",
      method: method,
      params: params || [],
      id: new Date().getTime()
    }, callback);
  };

  before('get current time', function(done) {
    web3.eth.getBlock('latest', function(err, block){
      if(err) return done(err)
      timestampBeforeJump = block.timestamp
      done()
    })
  })

  it('should jump 5 hours', function(done) {
    // Adjust time
    send("evm_increaseTime", [secondsToJump], function(err, result) {
      if (err) return done(err);

      // Mine a block so new time is recorded.
      send("evm_mine", function(err, result) {
        if (err) return done(err);

        web3.eth.getBlock('latest', function(err, block){
          if(err) return done(err)
          var secondsJumped = block.timestamp - timestampBeforeJump
          assert.ok(secondsJumped >= secondsToJump && secondsJumped < (secondsToJump + 5))
          done()
        })
      })
    })
  })
})
