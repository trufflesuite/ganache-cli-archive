var utils = require('ethereumjs-util');

var Swarm = function() {
  this.objects = {};
}

Swarm.prototype.store = function (content, callback) {
  var key = utils.setLengthLeft(utils.sha3(content), 32).toString('hex');
  this.objects[key] = content;
  callback(null, key);
}

Swarm.prototype.retrieve = function (key, callback) {
  if (!this.objects[key]) {
    return callback('Not found');
  }
  callback(null, this.objects[key]);
}

module.exports = Swarm;
