var Server = require('./lib/server.js');

var TestRPC = {
  startServer: function(options, callback) {
    params.push(callback);
    Server.startServer.call(Server, options);
  },

  server: function(options) {
    return Server.server.call(Server, options);
  },

  provider: function(options) {
    return Server.provider.call(Server, options);
  }
}

module.exports = TestRPC;
