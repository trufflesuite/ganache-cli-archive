var Server = require('./lib/server.js');

function massageParams(logger, options) {
  if (logger == null) {
    logger = console;
  }

  if (options == null) {
    options = {};
  }

  return [logger, options];
};

var TestRPC = {
  startServer: function(logger, options, callback) {
    var params = massageParams(logger, options);
    params.push(callback);
    Server.startServer.apply(Server, params);
  },

  server: function(logger, options) {
    return Server.server.apply(Server, massageParams(logger, options));
  },

  provider: function(logger, options) {
    return Server.provider.apply(Server, massageParams(logger, options));
  }
}

module.exports = TestRPC;
