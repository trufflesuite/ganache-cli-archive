var Interface = require('./lib/interface.js');

var TestRPC = {
  server: function(options) {
    return Interface.server(options);
  },

  ipcServer: function(options) {
    return Interface.ipcServer(options);
  },

  provider: function(options) {
    return Interface.provider(options);
  }
}

module.exports = TestRPC;
