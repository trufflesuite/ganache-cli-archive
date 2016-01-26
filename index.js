var Server = require('./lib/server.js');

var TestRPC = {
  startServer: function(port, logger) {
    Server.startServer(port, logger);
  },

  server: function(logger) {
    return Server.server(logger);
  },

  provider: function(logger) {
    return Server.provider(logger);
  }
}

module.exports = TestRPC;
