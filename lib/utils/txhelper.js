var to = require("./to");

module.exports = {
  toJSON: function(tx, block) {
    return {
      hash: to.hex(tx.hash()),
      nonce: to.hex(tx.nonce),
      blockHash: to.hex(block.hash()),
      blockNumber: to.hex(block.header.number),
      transactionIndex:  "0x0",
      from: to.hex(tx.getSenderAddress()),
      to: to.hex(tx.to),
      value: to.hex(tx.value), // 520464
      gas: to.hex(tx.gasLimit), // 520464
      gasPrice: to.hex(tx.gasPrice),
      input: to.hex(tx.data),
    };
  }
};
