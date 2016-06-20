var Web3 = require('web3');
var utils = require('ethereumjs-util');
var assert = require('assert');
var TestRPC = require("../index.js");

describe("custom eth_gasPrice", function() {
  it("should return gas price of 0xf", function(done) {
    var web3 = new Web3();
    var server = TestRPC.server({gasPrice: 15});
    var port = 12345;
    server.listen(port, function() {
      var oldprovider = web3.currentProvider;
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      web3.eth.getGasPrice(function(err, result) {
        if (err) return done(err);
        assert.deepEqual(result.toNumber(), 15);
        server.close();
        web3.setProvider(oldprovider);
        done();
      });
    });
  });
});

describe("custom eth_gasPrice in hex", function() {
  it("should return gas price of 0xf", function(done) {
    var web3 = new Web3();
    var server = TestRPC.server({gasPrice: 0xf});
    var port = 12346;
    server.listen(port, function() {
      var oldprovider = web3.currentProvider;
      web3.setProvider(new Web3.providers.HttpProvider("http://localhost:" + port));
      web3.eth.getGasPrice(function(err, result) {
        if (err) return done(err);
        assert.deepEqual(result.toNumber(), 15);
        server.close();
        web3.setProvider(oldprovider);
        done();
      });
    });
  });
});
