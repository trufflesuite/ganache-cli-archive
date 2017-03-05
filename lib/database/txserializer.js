var to = require("../utils/to");
var utils = require("ethereumjs-util");
var FakeTransaction = require("ethereumjs-tx/fake.js")

module.exports = {
  encode: function(tx, done) {
    var encoded = tx.toJSON(true);

    encoded.from = to.hex(tx.from);

    done(null, encoded);
  },
  decode: function(json, done) {
    // TODO: We can't use txhelper here because there are two
    // JSON serialization types: ethereumjs-tx, and web3.
    // Here we deserialize from ethereumjs-tx because it's
    // closer to the metal, so to speak.
    var tx = new FakeTransaction({
      nonce: utils.toBuffer(json.nonce),
      from: utils.toBuffer(json.from),
      value: utils.toBuffer(json.value),
      gasLimit: utils.toBuffer(json.gasLimit),
      gasPrice: utils.toBuffer(json.gasPrice),
      data: utils.toBuffer(json.data),
      v: utils.toBuffer(json.v),
      r: utils.toBuffer(json.r),
      s: utils.toBuffer(json.s)
    });

    done(null, tx);
  }
}
