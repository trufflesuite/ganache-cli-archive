var Server = require('./server.js');
var Manager = require('./manager.js');
var argv = require('yargs').argv;

var TestRPC = {
  startServer: function() {
    Server.startServer(argv.p || argv.port);
  },

  Manager: Manager
}

module.exports = TestRPC;
