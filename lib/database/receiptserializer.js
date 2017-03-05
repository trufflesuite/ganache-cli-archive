var to = require("../utils/to");
var Receipt = require("../utils/receipt");

function ReceiptSerializer(database) {
  this.database = database;
};

ReceiptSerializer.prototype.encode = function(receipt, done) {
  done(null, receipt.toJSON());
};

ReceiptSerializer.prototype.decode = function(json, done) {
  var self = this;

  this.database.transactions.get(json.transactionHash, function(err, tx) {
    if (err) return done(err);

    var blockNumber = to.number(json.blockNumber);

    self.database.blocks.get(blockNumber, function(err, block) {
      if (err) return done(err);

      self.database.blockLogs.get(blockNumber, function(err, logs) {
        if (err) return done(err);

        done(null, new Receipt(tx, block, logs, json.gasUsed, json.contractAddress));
      });
    });
  });
};

module.exports = ReceiptSerializer;
