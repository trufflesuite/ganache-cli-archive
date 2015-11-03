var Server = require('./server.js');
var Provider = require('./provider.js');
var Manager = require('./manager.js');
var argv = require('yargs').argv;

EtherSim = {
  startServer: function() {
    Server.startServer(argv.p || argv.port);
  },

  Provider: Provider,
  Manager: Manager,

  web3Provider: function() {
    var manager  = new this.Manager();
    var provider = new this.Provider(manager);

    return provider;
  }
}

module.exports = EtherSim;
