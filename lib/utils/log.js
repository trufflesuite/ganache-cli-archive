var to = require("./to.js");

// Expects:
//
// logIndex: ...
// transactionIndex: ...
// transactionHash: ...
// block: ...
// address: ...
// data: ...
// topics: ...
// type: ...

function Log(data) {
  var self = this;
  Object.keys(data).forEach(function(key) {
    self[key] = data[key];
  });
}

Log.prototype.toJSON = function() {
  return {
    logIndex: this.logIndex,
    transactionIndex: to.hex(this.transactionIndex),
    transactionHash: to.hex(this.transactionHash),
    blockHash: to.hex(this.block.hash()),
    blockNumber: to.hex(this.block.header.number),
    address: to.hex(this.address),
    data: to.hex(this.data),
    topics: this.topics,
    type: "mined"
  };
};

module.exports = Log;
