var Subprovider = require('web3-provider-engine/subproviders/subprovider.js');
var inherits = require("util").inherits;
var Web3 = require("web3");

inherits(FallbackProvider, Subprovider);

module.exports = FallbackProvider;

function FallbackProvider(ipAddressAndPort) {
  this.ipAddressAndPort = ipAddressAndPort;
  this.httpWeb3         = new Web3();

  this.httpWeb3.setProvider(new Web3.providers.HttpProvider(ipAddressAndPort));

  this.highBlockNumber  = this.httpWeb3.eth.blockNumber;

};

// Massage eth_estimateGas requests, setting default data (e.g., from) if
// not specified. This is here specifically to make the testrpc
// react like Geth.
FallbackProvider.prototype.handleRequest = function(payload, next, end) {
  next();
};
