var Blockchain = require('../lib/blockchain.js');
var assert = require('assert');

describe('fastrpc.blockchain', function() {

  describe("#accountAddresses", function() {
    var blockchain = new Blockchain();

    it("should return list of addresses", function() {
      blockchain.addAccount({secretKey: '3cd7232cd6f3fc66a57a6bedc1a8ed6c228fff0a327e169c2bcc5e869ed49511'});

      assert.deepEqual(blockchain.accountAddresses(), ["0xca35b7d915458ef540ade6068dfe2f44e8fa733c"]);
    });

  });

  describe("#addBlock", function() {
    var blockchain = new Blockchain();
    blockchain.addBlock();

    it("increase block number", function() {
      assert.deepEqual(blockchain.blockNumber, 2);
    });

    it("add block", function() {
      assert.deepEqual(blockchain.blocks.length, 1);
    });

  });

});

