var Blockchain = require('../lib/blockchain.js');
var Block = require('../lib/block.js');
var assert = require('assert');

describe('fastrpc.block', function() {

  describe("#runTransaction", function() {
    var blockchain = new Blockchain();
    blockchain.addAccount({secretKey: '3cd7232cd6f3fc66a57a6bedc1a8ed6c228fff0a327e169c2bcc5e869ed49511'});
    var blockNumber = blockchain.blockNumber;
    var currentHash = blockchain.lastBlockHash;
    var currentTime = blockchain.time;
    var block = new Block(blockchain, blockNumber, currentHash, currentTime);

    it("should add to list of transactions", function() {
      block.runTransaction({}, function() {
      });

      assert.deepEqual(block.transactions.length, 1);
      assert.deepEqual(block.transactionsHashes().length, 1);
    });

  });

});

