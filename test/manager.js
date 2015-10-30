var Blockchain = require('../lib/manager.js');
var Provider = require('../lib/provider.js');
var web3 = require('web3');
var assert = require('assert');

describe('fastrpc.manager', function() {
  var manager = new Manager();
  web3.setProvider(new Provider(manager));
  var block, contractAddress;

  describe("#request", function() {

    describe("eth_accounts", function() {
      it("should return list of addresses", function() {
        var accounts = web3.eth.accounts;

        assert.deepEqual(accounts.length, 1);
      });
    });

    describe("eth_blockNumber", function() {
      it("should return correct block number", function() {
        var number = web3.eth.blockNumber;
        assert.deepEqual(number, 2);

        manager.mine();

        var number = web3.eth.blockNumber;
        assert.deepEqual(number, 3);
      });
    });

    describe("eth_coinbase", function() {
      it("should return correct address", function() {
        var coinbase = web3.eth.coinbase;

        assert.deepEqual(coinbase, manager.blockchain.accountAddresses()[0]);
      });
    });

    describe("eth_mining", function() {
      it("should return correct address", function() {
        var mining = web3.eth.mining;

        assert.deepEqual(mining, false);
      });
    });

    describe("eth_hashrate", function() {
      it("should return hashrate", function() {
        var hashrate = web3.eth.hashrate;

        assert.deepEqual(hashrate, 0);
      });
    });

    describe("eth_gasPrice", function() {
      it("should return gas price", function() {
        var gasPrice = web3.eth.gasPrice;

        assert.deepEqual(gasPrice.toNumber(), '0x09184e72a000');
      });
    });

    describe("eth_getBalance", function() {
      it("should return balance", function() {
        var balance = web3.eth.getBalance(web3.eth.accounts[0]);

        assert.deepEqual(balance.toString(), '2.1267647932558653671313007785132687361e+37');
      });
    });

    describe("eth_getStorageAt", function() {
      it("should return storage at a specific position"); //, function() {
      //  var state = web3.eth.getStorageAt("0x123");

      //  assert.deepEqual(state, '0x00000000000000000001');
      //});
    });

    describe("eth_getCode", function() {
      var transactionResult;
      var code = '0x60606040525b60646000600050819055505b60c280601e6000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480632a1afcd914604b57806360fe47b114606a5780636d4ce63c14607b576049565b005b6054600450609a565b6040518082815260200191505060405180910390f35b607960048035906020015060a3565b005b608460045060b1565b6040518082815260200191505060405180910390f35b60006000505481565b806000600050819055505b50565b6000600060005054905060bf565b9056';

      beforeEach(function(done) {
        block = manager.blockchain.blocks[0];
        var transaction = new Transaction({data: code});

        transaction.run(block, function(result) {
          transactionResult = result;
          done();
        });

      });

      it("should return code at a specific address", function() {
        contractAddress = transactionResult.address;
        var result = web3.eth.getCode(transactionResult.address);

        assert.deepEqual(result, code);
      });
    });

    describe("eth_getBlockByNumber", function() {
      it("should return block given the block number", function() {
        block = manager.blockchain.blocks[0];
        var blockHash = web3.eth.getBlock(0);

        resultHash = {
          "difficulty": {
            "c": [
              266253
            ],
            "e": 5,
            "s": 1,
          },
          "extraData": "0x476574682f76312e302e322f64617277696e2f676f312e35",
          "gasLimit": 4767305,
          "gasUsed": 94181,
          "hash": block.hash(),
          "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "miner": "0x8c302937c90d1a68253de03c1398595009381eb3",
          "nonce": "0x4332a3d2ad553d23",
          "number": 2,
          "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          "size": 906,
          "stateRoot": "0xc5b7816d17bdd2e409375408b54be42fa690c7f1b6c9d94bce2debf01faa93ed",
          "timestamp": manager.blockchain.time,
          "totalDifficulty": {
            "c": [
              13485108
            ],
            "e": 7,
            "s": 1
          },
          "transactions": [],
          "transactionsRoot": "0x5409c6eef38ff27507a14cb27da502b144f19eddbf67e890fabd9db244f4b217",
          "uncles": []
        }

        assert.deepEqual(blockHash, resultHash);
      });
    });

    describe("eth_getBlockByHash", function() {
      it("should return block given the block hash", function() {
        block = manager.blockchain.blocks[0];
        var blockHash = web3.eth.getBlock(block.hash());

        resultHash = {
          "difficulty": {
            "c": [
              266253
            ],
            "e": 5,
            "s": 1,
          },
          "extraData": "0x476574682f76312e302e322f64617277696e2f676f312e35",
          "gasLimit": 4767305,
          "gasUsed": 94181,
          "hash": block.hash(),
          "logsBloom": "0x00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "miner": "0x8c302937c90d1a68253de03c1398595009381eb3",
          "nonce": "0x4332a3d2ad553d23",
          "number": 2,
          "parentHash": "0x0000000000000000000000000000000000000000000000000000000000000000",
          "sha3Uncles": "0x1dcc4de8dec75d7aab85b567b6ccd41ad312451b948a7413f0a142fd40d49347",
          "size": 906,
          "stateRoot": "0xc5b7816d17bdd2e409375408b54be42fa690c7f1b6c9d94bce2debf01faa93ed",
          "timestamp": manager.blockchain.time,
          "totalDifficulty": {
            "c": [
              13485108
            ],
            "e": 7,
            "s": 1
          },
          "transactions": [],
          "transactionsRoot": "0x5409c6eef38ff27507a14cb27da502b144f19eddbf67e890fabd9db244f4b217",
          "uncles": []
        }

        assert.deepEqual(blockHash, resultHash);
      });
    });

    describe("eth_getBlockTransactionCountByNumber", function() {
      it("should return number of transactions in a given block"); //, function() {
    });

    describe("eth_getBlockTransactionCountByHash", function() {
      it("should return number of transactions in a given block"); //, function() {
    });

    describe("eth_getUncleByBlockNumberAndIndex", function() {
      it("should return uncles in a given block"); //, function() {
    });

    describe("eth_getUncleByBlockHashAndIndex", function() {
      it("should return uncles in a given block"); //, function() {
    });

    describe("eth_getTransactionByHash", function() {
      it("should return transaction"); //, function() {
    });

    describe("eth_getTransactionByBlockNumberAndIndex", function() {
      it("should return transaction"); //, function() {
    });

    describe("eth_getTransactionByBlockHashAndIndex", function() {
      it("should return transaction"); //, function() {
    });

    describe("eth_getTransactionReceipt", function() {
      var transactionResult;

      describe("contract creation", function() {
        beforeEach(function(done) {
          var code = '60606040525b60646000600050819055505b60c280601e6000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480632a1afcd914604b57806360fe47b114606a5780636d4ce63c14607b576049565b005b6054600450609a565b6040518082815260200191505060405180910390f35b607960048035906020015060a3565b005b608460045060b1565b6040518082815260200191505060405180910390f35b60006000505481565b806000600050819055505b50565b6000600060005054905060bf565b9056';
          var transaction = new Transaction({data: code});
          hash = transaction.hash;

          transaction.run(block, function(result) {
            transactionResult = result
            done();
          });
        });

        it("should return receipt", function() {
          var transactionHash = transactionResult.result;
          var receipt = web3.eth.getTransactionReceipt(transactionHash);

          assert.deepEqual(receipt.contractAddress, transactionResult.address);
        });

      });

      describe("transaction", function() {
        beforeEach(function(done) {
          var transaction = new Transaction({
            data: '60fe47b10000000000000000000000000000000000000000000000000000000000000096',
            to: '692a70d2e424a56d2c6c27aa97d1a86395877b3a'
          });
          hash = transaction.hash;

          transaction.run(block, function(result) {
            transactionResult = result
            done();
          });
        });

        it("should return receipt", function() {
          var transactionHash = transactionResult.result;
          var receipt = web3.eth.getTransactionReceipt(transactionHash);

          assert.deepEqual(receipt.contractAddress, null);
        });

      });

    });

    describe("eth_getTransactionCount", function() {
      it("should return number of transactions sent from an address"); //, function() {
    });

    describe("eth_sendTransaction", function() {

      describe("sending funds", function() {
        var transactionHash = "";

        beforeEach(function(done) {
          var account = web3.eth.accounts[0];
          manager.blockchain.addAccount({balance: '00000'});

          transactionHash = web3.eth.sendTransaction({
            from: account,
            to: web3.eth.accounts[1],
            value: 12345
          }, function(error, results) {
            done();
          })
        });

        it("should transfer funds"); //, function(done) {
        //  web3.eth.getBalance(web3.eth.accounts[1], function(error, results) {
        //    assert.deepEqual(results.toNumber(), 12345);
        //    done();
        //  });
        //});

      });

    });

    describe("eth_call", function() {
      var transactionResult, result;

      beforeEach(function(done) {
        var code = '60606040525b60646000600050819055505b60c280601e6000396000f30060606040526000357c0100000000000000000000000000000000000000000000000000000000900480632a1afcd914604b57806360fe47b114606a5780636d4ce63c14607b576049565b005b6054600450609a565b6040518082815260200191505060405180910390f35b607960048035906020015060a3565b005b608460045060b1565b6040518082815260200191505060405180910390f35b60006000505481565b806000600050819055505b50565b6000600060005054905060bf565b9056';

        block = manager.blockchain.blocks[0];
        var transaction = new Transaction({data: code});

        transaction.run(block, function(result) {
          transactionResult = result;

          result = web3.eth.call({
            data: '0x6d4ce63c',
            to: transactionResult.address
          }, function(error, results) {
            transactionResult = results;
            done();
          });
        });
      });

      it("should return value", function() {
        console.log(transactionResult);
        assert.deepEqual(eval(transactionResult), 100);
      });

    });

  });

});

