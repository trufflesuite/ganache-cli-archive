var VM = require('ethereumjs-vm');
var Account = require('ethereumjs-account');
var Trie = require('merkle-patricia-tree');
var Transaction = require('ethereumjs-tx');
var utils = require('ethereumjs-util');
var Server = require('./server.js');
var Provider = require('./provider.js');
var Manager = require('./manager.js');

EtherSim = {

  startServer: function() {
    Server.startServer();
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

