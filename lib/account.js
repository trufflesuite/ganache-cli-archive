var utils = require('ethereumjs-util');
var EthereumjsAccount = require('ethereumjs-account');
var crypto = require('crypto');

/**
  *  @params
  *  * {hexString} secret
  *  * {hexString} balance
  */
Account = function(_params) {
  var params = _params || {};
  this.secretKey = params.secretKey || crypto.randomBytes(32).toString('hex');
  this.publicKey = utils.privateToPublic(new Buffer(this.secretKey, 'hex')).toString('hex');

  this._address = utils.pubToAddress(new Buffer(this.publicKey, 'hex'));
  this.address = this._address.toString('hex');
  this.account = new EthereumjsAccount();
  this.account.balance = params.balance || '0xffffffffffffff00000000000000001';
}

Account.prototype.serialize = function() {
  return this.account.serialize();
}

Account.prototype.balance = function() {
  return this.account.balance.toString('hex');
}

module.exports = Account;
