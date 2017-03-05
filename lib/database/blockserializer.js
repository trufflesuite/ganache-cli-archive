var to = require("../utils/to");
var txserializer = require("./txserializer");
var async = require("async");
var Block = require("ethereumjs-block");

module.exports = {
  encode: function(block, done) {
    var encoded = block.toJSON(true);

    // We could use the tx serializer, but most of the work is already done.
    // PS: The line within the loop is a copy/paste.
    block.transactions.forEach(function(tx, index) {
      encoded.transactions[index].from = to.hex(tx.from);
    });

    done(null, encoded);
  },
  decode: function(json, done) {
    var transactions = json.transactions;
    json.transactions = [];

    var block = new Block(json);

    async.eachSeries(json.transactions, function(tx_json, finished) {
      txserializer.decode(tx_json, function(err, tx) {
        if (err) return finished(err);
        block.transactions.push(tx);
        finished();
      });
    }, function(err) {
      if (err) return done(err);
      done(null, block);
    });
  }
}
