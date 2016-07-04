var Subprovider = require('web3-provider-engine/subproviders/subprovider.js');
var inherits = require("util").inherits;

inherits(FallbackProvider, Subprovider);

module.exports = FallbackProvider;

function FallbackProvider(ipAddressAndPort) {
  this.ipAddressAndPort = ipAddressAndPort;
};

// Massage eth_estimateGas requests, setting default data (e.g., from) if
// not specified. This is here specifically to make the testrpc
// react like Geth.
FallbackProvider.prototype.handleRequest = function(payload, next, end) {
  console.log("Checking fallback at " + this.ipAddressAndPort);
  next();
};
