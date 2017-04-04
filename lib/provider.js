var ProviderEngine = require("web3-provider-engine");
var FilterSubprovider = require('web3-provider-engine/subproviders/filters.js');
var VmSubprovider = require('web3-provider-engine/subproviders/vm.js');
var SolcSubprovider = require('web3-provider-engine/subproviders/solc.js')

var BlockchainDouble = require('./blockchain_double.js');

var RequestFunnel = require('./subproviders/requestfunnel.js');
var DelayedBlockFilter = require("./subproviders/delayedblockfilter.js");
var ReactiveBlockTracker = require("./subproviders/reactiveblocktracker.js");
var GethDefaults = require("./subproviders/gethdefaults.js");
var GethApiDouble = require('./subproviders/geth_api_double.js');

module.exports = function(options) {
  var self = this;

  if (options == null) {
    options = {};
  }

  if (options.logger == null) {
    options.logger = {
      log: function() {}
    };
  }

  var engine = new ProviderEngine();

  var gethApiDouble = new GethApiDouble(options);

  engine.manager = gethApiDouble;
  engine.addProvider(new RequestFunnel());
  engine.addProvider(new ReactiveBlockTracker());
  engine.addProvider(new DelayedBlockFilter());
  engine.addProvider(new FilterSubprovider());
  engine.addProvider(new GethDefaults());
  engine.addProvider(new VmSubprovider());
  engine.addProvider(new SolcSubprovider());
  engine.addProvider(gethApiDouble);

  engine.setMaxListeners(100);
  engine.start();

  var externalize = function(payload) {
    var clone = {};
    var keys = Object.keys(payload);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      clone[key] = payload[key];
    }
    clone.external = true;
    return clone;
  };

  // Mimic the provider interface, marking requests as external.
  return {
    manager: gethApiDouble,
    sendAsync: function(payload, callback) {
      if (Array.isArray(payload)) {
        for (var i = 0; i < payload.length; i++) {
          payload[i] = externalize(payload[i]);
        }
      } else {
        payload = externalize(payload);
      }

      // if (options.fallback) {
      //   console.log("payload", JSON.stringify(payload, null, 2));
      // }

      var intermediary = callback;

      if (options.verbose) {
        options.logger.log("   > " + JSON.stringify(payload, null, 2).split("\n").join("\n   > "));

        intermediary = function(err, result) {
          if (!err) {
            options.logger.log(" <   " + JSON.stringify(result, null, 2).split("\n").join("\n <   "));
          }
          callback(err, result);
        };
      }

      engine.sendAsync(payload, intermediary);
    },
    send: function() {
      throw new Error("Synchronous requests are not supported.");
    },
    close: function(callback) {
      // This is a little gross reaching
      gethApiDouble.state.blockchain.close(callback);
    }
  };
};
