var inherits = require("util").inherits;
var to = require("./to");

inherits(RuntimeError, Error);

// Note: ethereumjs-vm will return an object that has a "results" and "receipts" keys.
// You should pass in the whole object.
function RuntimeError(transactions, vm_output) {
  Error.call(this);
  this.results = {};
  this.combine(transactions, vm_output);
};

RuntimeError.prototype.combine = function(transactions, vm_output) {
  // Can be combined with vm_output or another RuntimeError.
  if (transactions instanceof RuntimeError) {
    var err = transactions;
    var keys = Object.keys(err.results);

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      this.results[key] = err.results[key];
    }
  } else {
    var results = vm_output.results;
    var receipts = vm_output.receipts;

    for (var i = 0; i < transactions.length; i++) {
      var tx = transactions[i];
      var result = results[i];
      var receipt = receipts[i];

      // 1 means no error, oddly.
      if (result.vm.exception != 1) {
        this.results[to.hex(tx.hash())] = result.vm.exceptionError;
      }
    }
  }

  var hashes = Object.keys(this.results);

  // Once combined, set the message
  if (hashes.length == 1) {
    this.message = "VM Exception while processing transaction: " + this.results[hashes[0]];
  } else {
    this.message = "Multiple VM Exceptions while processing transactions: \n\n";

    for (var i = 0; i < hashes.length; i++) {
      var hash = hashes[i];

      this.message += hash + ": " + this.results[hash] + "\n";
    }
  }
};

RuntimeError.prototype.count = function() {
  return Object.keys(this.results).length;
};

RuntimeError.fromResults = function(transactions, vm_output) {
  var err = new RuntimeError(transactions, vm_output);

  if (err.count() == 0) {
    return null;
  }

  return err;
};

module.exports = RuntimeError;
