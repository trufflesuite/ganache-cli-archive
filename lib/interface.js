var http = require("http");

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

var Interface = {
  server: function(options) {
    if (options == null) {
      options = {};
    }

    if (options.logger == null) {
      options.logger = {
        log: function() {}
      };
    }

    var logger = options.logger;
    var provider = this.provider(options);
    var server = http.createServer(function(request, response) {

      var headers = request.headers;
      var method = request.method;
      var url = request.url;
      var body = [];

      request.on('error', function(err) {
        // console.error(err);
      }).on('data', function(chunk) {
        body.push(chunk);
      }).on('end', function() {
        body = Buffer.concat(body).toString();
        // At this point, we have the headers, method, url and body, and can now
        // do whatever we need to in order to respond to this request.

        var headers = {
          "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "*"
        };

        switch (method) {
          case "OPTIONS":
            headers["Content-Type"] = "text/plain"
            response.writeHead(200, headers);
            response.end("");
            break;
          case "POST":
            //console.log("Request coming in:", body);

            var payload;
            try {
              payload = JSON.parse(body);
            } catch(e) {
              headers["Content-Type"] = "text/plain";
              response.writeHead(400, headers);
              response.end("400 Bad Request");
              return;
            }

            // Log messages that come into the TestRPC via http
            if (payload instanceof Array) {
              // Batch request
              for (var i = 0; i < payload.length; i++) {
                var item = payload[i];
                logger.log(item.method);
              }
            } else {
              logger.log(payload.method);
            }

            provider.sendAsync(payload, function(err, result) {
              headers["Content-Type"] = "application/json";
              response.writeHead(200, headers);
              response.end(JSON.stringify(result));
            });

            break;
          default:
            response.writeHead(400, {
              "Access-Control-Allow-Headers": "Origin, X-Requested-With, Content-Type, Accept",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "*",
              "Content-Type": "text/plain"
            });
            response.end("400 Bad Request");
            break;
        }
      });
    });

    var oldListen = server.listen;

    server.listen = function() {
      var args = Array.prototype.slice.call(arguments);
      var callback = function() {};
      if (args.length > 0) {
        var last = args[args.length - 1];
        if (typeof last == "function") {
          callback = args.pop();
        }
      }

      var intermediary = function(err) {
        if (err) return callback(err);
        server.provider.manager.waitForInitialization(function(err, accounts) {
          callback(err, accounts);
        });
      };

      args.push(intermediary);

      oldListen.apply(server, args);
    }

    server.provider = provider;

    return server;
  },

  provider: function(options) {
    var self = this;

    if (options == null) {
      options = {};
    }

    if (options.logger == null) {
      options.logger = {
        log: function() {}
      };
    }

    options.blockchain = new BlockchainDouble(options);

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
      }
    };
  }
}

module.exports = Interface;
