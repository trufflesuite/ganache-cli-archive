var to = require("./to");
var FakeTransaction = require('ethereumjs-tx/fake.js');
var utils = require("ethereumjs-util");

// TODO - verry dirty - refactor to fake.js
// FakeTransaction.prototype.hash = function () {
//   return this._hash;
// }

module.exports = {
  toJSON: function(tx, block) {
    return {
      hash: to.hex(tx.hash()),
      nonce: to.hex(tx.nonce),
      blockHash: to.hex(block.hash()),
      blockNumber: to.hex(block.header.number),
      transactionIndex:  "0x0",
      from: to.hex(tx.from),
      to: to.hex(tx.to),
      value: to.hex(tx.value), // 520464
      gas: to.hex(tx.gasLimit), // 520464
      gasPrice: to.hex(tx.gasPrice),
      input: to.hex(tx.data),
    };
  },

  fromJSON: function(json) {
    var tx = new FakeTransaction({
      nonce: utils.toBuffer(json.nonce),
      from: utils.toBuffer(json.from),
      value: utils.toBuffer("0x" + json.value.toString(16)),
      gasLimit: utils.toBuffer(json.gas),
      gasPrice: utils.toBuffer("0x" + json.gasPrice.toString(16)),
      data: utils.toBuffer(json.input)
    });
    tx._hash = json.hash;

    // Remove all padding and make it easily comparible.
    var to = utils.bufferToInt(utils.toBuffer(json.to));

    if (json.to && to != 0) {
      tx.to = utils.setLengthLeft(utils.toBuffer(json.to), 20);
    }

    return tx;
  }
};
