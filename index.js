var Server = require('./lib/server.js');
var argv = require('yargs').argv;

var TestRPC = {
  startServer: function() {
    Server.startServer(argv.p || argv.port);
  },

  provider: function() {
    return Server.provider();
  }
}

module.exports = TestRPC;
