var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');
var solc = require("solc");

var source = "                     \
contract EventTest {               \
  event NumberEvent(uint number);   \
                                   \
  function triggerEvent(uint val) {        \
    NumberEvent(val);        \
  }                                \
}"

// Thanks solc. At least this works!
// This removes solc's overzealous uncaughtException event handler.
process.removeAllListeners("uncaughtException");

var tests = function(web3, EventTest) {
  var accounts;
  var EventTest;
  var instance;

  describe("events", function() {
    before(function(done) {
      web3.eth.getAccounts(function(err, accs) {
        if (err) return done(err);
        accounts = accs;
        done();
      });
    });

    before(function() {
      var result = solc.compile(source, 1);

      if (result.errors != null) {
        throw new Error(result.errors[0]);
      }

      var abi = JSON.parse(result.contracts.EventTest.interface);
      EventTest = web3.eth.contract(abi);
      EventTest._data = "0x" + result.contracts.EventTest.bytecode;
    });

    before(function(done) {
      EventTest.new({from: accounts[0], data: EventTest._data}, function(err, contract) {
        if (!contract.address) {
          return;
        }
        instance = contract;
        done();
      });
    });

    it("handles events properly, using `event.watch()`", function(done) {
      var expected_value = 5;

      var event = instance.NumberEvent([{number: expected_value}]);

      var cleanup = function(err) {
        event.stopWatching();
        done(err);
      };

      event.watch(function(err, result) {
        if (err) return done(err);

        if (result.args.number == expected_value) {
          return cleanup();
        }

        return cleanup(new Error("Received event that didn't have the correct value!"));
      });

      instance.triggerEvent(5, {from: accounts[0]}, function(err, result) {
        if (err) return cleanup(err);
      });
    });

    it("handles events properly, using `event.get()`", function(done) {
      this.timeout(10000)
      var expected_value = 5;
      var interval;

      var event = instance.NumberEvent([{number: expected_value}]);

      function cleanup(err) {
        event.stopWatching();
        clearInterval(interval);
        done(err);
      }

      instance.triggerEvent(5, {from: accounts[0]}, function(err, result) {
        if (err) return cleanup(err);

        interval = setInterval(function() {
          event.get(function(err, logs) {
            if (err) return cleanup(err);

            if (logs.length == 0) return;

            if (logs[0].args.number == expected_value) {
              return cleanup();
            }

            return cleanup(new Error("Received event that didn't have the correct value!"));
          });
        }, 500);
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
