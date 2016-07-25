var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');

var tests = function(web3) {
  var accounts;

  // The second request, after the first in each of these tests,
  // informs us whether or not the provider crashed.
  function secondRequest(callback) {
    web3.eth.getAccounts(callback);
  }

  describe("bad input", function() {
    before(function(done) {
      web3.eth.getAccounts(function(err, accs) {
        if (err) return done(err);
        accounts = accs;
        done();
      });
    });

    it("recovers after to address that isn't a string", function(done) {

      var provider = web3.currentProvider;

      provider.sendAsync({
        "jsonrpc": "2.0",
        "method": "eth_sendTransaction",
        "params": [
          {
            "value": "0x0",
            "gas": "0xf4240",
            "from": accounts[0],
            // Buffers have been sent in the past
            "to": {
              "type": "Buffer",
              "data": [
                // ...
              ]
            },
            "data": "0xe1fa8e84666f6f0000000000000000000000000000000000000000000000000000000000"
          }
        ],
        "id": 2
      }, function() {
        // Ignore any errors, but make sure we can make the second request
        secondRequest(done);
      });
    });
  })
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
