
TestProvider = function(_manager) {
  this.manager = _manager;
};

TestProvider.prototype.send = function(payload) {
  return this.manager.request(payload);
}

TestProvider.prototype.sendAsync = function(payload, callback) {
  return this.manager.request(payload, callback);
}

TestProvider.prototype.isConnected = function() {
  return true;
}

module.exports = TestProvider;

