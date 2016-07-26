var Interface = require('./lib/interface.js');

var TestRPC = {
  server: function(options) {
    return Interface.server(options);
  },

  provider: function(options) {
    return Interface.provider(options);
  }
}

module.exports = TestRPC;
