var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');
var solc = require("solc");

var source = "\
library Lib {\
  function something(int self) {\
    self = self + 1;\
  }\
}\
\
contract Main {\
  using Lib for int;\
  int foo;\
\
  function Main() {\
  }\
\
  function doSomething() {\
    foo.something();\
  }\
}\
";

process.removeAllListeners("uncaughtException");

var tests = function(web3, Main) {
  var accounts;
  var instance;
  var Main;
  var Lib;
  var libAddress;

  describe("calling library functions", function() {
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

      var abi = JSON.parse(result.contracts.Main.interface);
      Main = web3.eth.contract(abi);
      Main._data = "0x" + result.contracts.Main.bytecode;

      abi = JSON.parse(result.contracts.Lib.interface);
      Lib = web3.eth.contract(abi);
      Lib._data = "0x" + result.contracts.Lib.bytecode;
    });

    before(function(done) {
      Lib.new({from: accounts[0], data: Lib._data}, function(err, contract) {
        if (!contract.address) {
          return;
        }
        libAddress = contract.address;
        done();
      });
    });

    before(function(done) {
      var data = Main._data.replace('__Lib___________________________________',
                                    libAddress.replace("0x", ""));
      console.log(data);
      Main.new({from: accounts[0], data: data}, function(err, contract) {
        if (!contract.address) {
          return;
        }
        instance = contract;
        done();
      });
    });

    var balanceBefore;
    before(function(done) {
      web3.eth.getBalance(accounts[0], function(err, result) {
        balanceBefore = web3.fromWei(result).toNumber();
        done();
      });
    });

    it("spends Ether only once", function(done) {
      var account = accounts[0];
      instance.doSomething({from: accounts[0], value: web3.toWei(1)}, function(err, result) {
        if (err) return done(err);

        web3.eth.getBalance(accounts[0], function(err, result) {
          var balanceAfter = web3.fromWei(result).toNumber();
          var difference = balanceBefore-balanceAfter;
          assert(difference < 1.0001,
                 'Amount spent should be (close to) 1 Ether, but is ' + difference);
          done();
        }); 
      });
    });

  });
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

  //tests(web3);
});