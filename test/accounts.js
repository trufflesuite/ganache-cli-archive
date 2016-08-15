var Web3 = require('web3');
var TestRPC = require("../index.js");
var assert = require('assert');

describe("Accounts", function() {
  it("should respect the BIP99 mnemonic", function(done) {
    var expected_address = "0x604a95C9165Bc95aE016a5299dd7d400dDDBEa9A";

    var web3 = new Web3();
    web3.setProvider(TestRPC.provider({
      mnemonic: "into trim cross then helmet popular suit hammer cart shrug oval student"
    }));

    web3.eth.getAccounts(function(err, accounts) {
      if (err) return done(err);

      assert(accounts[0].toLowerCase(), expected_address.toLowerCase());
      done();
    });
  })
});
