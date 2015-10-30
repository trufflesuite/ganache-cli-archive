var Blockchain = require('../lib/blockchain.js');
var Block = require('../lib/block.js');
var Transaction = require('../lib/transaction.js');
var assert = require('assert');

describe('fastrpc.transaction', function() {
  var blockchain = new Blockchain();
  blockchain.addAccount({secretKey: '3cd7232cd6f3fc66a57a6bedc1a8ed6c228fff0a327e169c2bcc5e869ed49511'});
  var blockNumber = blockchain.blockNumber;
  var currentHash = blockchain.lastBlockHash;
  var currentTime = blockchain.time;
  var block = new Block(blockchain, blockNumber, currentHash, currentTime);
  var transactionResult, transactionResult2;

  describe("#run", function() {

    describe("create a contract", function() {

      beforeEach(function(done) {
        var transaction = new Transaction({
          data: '60606040525b60646000600050819055505b60c280601e6000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480632a1afcd914604b57806360fe47b114606a5780636d4ce63c14607b576049565b005b6054600450609a565b6040518082815260200191505060405180910390f35b607960048035906020015060a3565b005b608460045060b1565b6040518082815260200191505060405180910390f35b60006000505481565b806000600050819055505b50565b6000600060005054905060bf565b9056'
        });

        transaction.run(block, function(result) {
          transactionResult = result;
          done();
        });

      });

      it("create a contract", function() {
        assert.deepEqual(transactionResult.status, 'contract');
        assert.deepEqual(transactionResult.address, '0x692a70d2e424a56d2c6c27aa97d1a86395877b3a');
      });

    });

    describe("query a contract", function() {

      beforeEach(function(done) {
        var transaction = new Transaction({
          data: '0x6d4ce63c',
          to: '0x692a70d2e424a56d2c6c27aa97d1a86395877b3a'
        });

        transaction.run(block, function(result) {
          transactionResult = result;
          done();
        });

      });

      it("return the correct value", function() {
        assert.deepEqual(transactionResult.status, 'result');
        assert.deepEqual(eval(transactionResult.result), 100);
      });

    });

    describe("modify a contract", function() {

      beforeEach(function(done) {
        var transaction = new Transaction({
          data: '60fe47b10000000000000000000000000000000000000000000000000000000000000096',
          to: '692a70d2e424a56d2c6c27aa97d1a86395877b3a'
        });

        transaction.run(block, function(result) {
          transactionResult = result;

          var transaction = new Transaction({
            data: '6d4ce63c',
            to: '692a70d2e424a56d2c6c27aa97d1a86395877b3a'
          });

          transaction.run(block, function(result) {
            transactionResult2 = result;
            done();
          });
        });

      });

      it("set the correct value", function() {
        assert.deepEqual(transactionResult.status, 'transaction');
        assert.deepEqual(transactionResult2.status, 'result');
        assert.deepEqual(eval(transactionResult2.result), 150);
      });

    });

  });

});
