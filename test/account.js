var Account = require('../lib/account.js');
var assert = require('assert');

describe('fastrpc.account', function() {

  describe("create new account", function() {
    var account = new Account({secretKey: '3cd7232cd6f3fc66a57a6bedc1a8ed6c228fff0a327e169c2bcc5e869ed49511'});

    it("should generate an address", function() {
      assert.strictEqual(account.address, "ca35b7d915458ef540ade6068dfe2f44e8fa733c");
    });
  });

});
