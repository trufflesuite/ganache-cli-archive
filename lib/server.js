var jayson = require("jayson");
var Manager = require('./manager.js');
var httpProxy = require('http-proxy');
var pkg = require("../package.json");



//'Access-Control-Allow-Origin': '*'

// This is a super big hack from the following link to
// dynamically create functions with the right arity.
// http://stackoverflow.com/questions/13271474/override-the-arity-of-a-function
//
// The point is so we can leave all those functions in the manager
// and not have it clog things up here. jayson will error if a function
// doesn't have any arity.
var argNames = 'abcdefghijklmnopqrstuvwxyz';
var makeArgs = function(n) { return [].slice.call(argNames, 0, n).join(','); };

function giveArity(f, n) {
    return eval('(function('+makeArgs(n)+') { return f.apply(this, arguments); })')
}

Server = {
  createHandler: function(manager, logger, method) {
    var fn = manager[method];

    var wrapped = function() {
      logger.log(method);
      var args = Array.prototype.slice.call(arguments);
      var callback = args.pop();
      args.push(function(err, result) {
        if (err != null) {
          callback({code: -32000, message: err.message || err});
        } else {
          callback(null, result);
        }
      })

      fn.apply(manager, args);
    }

    return giveArity(wrapped, fn.length);
  },

  server: function(logger) {
    var self = this;

    if (logger == null) {
      logger = console;
    }

    var manager = new Manager(logger);

    var methods = [
      'eth_accounts',
      'eth_blockNumber',
      'eth_call',
      'eth_coinbase',
      'eth_compileSolidity',
      'eth_gasPrice',
      'eth_getBalance',
      'eth_getBlockByNumber',
      'eth_getBlockByHash',
      'eth_getCompilers',
      'eth_getCode',
      'eth_getFilterChanges',
      'eth_getStorageAt',
      'eth_getTransactionByHash',
      'eth_getTransactionCount',
      'eth_getTransactionReceipt',
      'eth_hashrate',
      'eth_mining',
      'eth_newBlockFilter',
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'eth_uninstallFilter',
      'web3_clientVersion',
      'evm_snapshot',
      'evm_revert'
    ];

    var functions = {};

    methods.forEach(function(method) {
      functions[method] = self.createHandler(manager, logger, method);
    });

    // TODO: the reviver option is a hack to allow batches to work with jayson
    // it become unecessary after the fix of this bug https://github.com/ethereum/web3.js/issues/345
    var server = jayson.server(functions, {
      reviver: function(key, val) {
        if (typeof val === 'object' && val.hasOwnProperty('method') &&
            val.method === 'eth_call' && val.hasOwnProperty('params') &&
            val.params.constructor === Array && val.params.length === 1)
          val.params.push('latest');
        return val;
      }
    });

    server.manager = manager;
    server.logger = logger;

    return server;
  },

  // TODO: Make this class-like to allow for multiple providers?
  provider: function(logger) {
    if (logger == null) {
      logger = {
        log: function() {}
      };
    }

    var server = this.server(logger);
    var manager = server.manager;
    var middleware = server.middleware({end: false});

    var provider = {
      send: function() {
        throw new Error("ethereumjs-testrpc does not support synchronous requests.");
      },

      sendAsync: function(payload, callback) {
        var self = this;

        if (manager.initialized == false) {
          manager.initialize(function() {
            self.handleRequest(payload, callback);
          })
        } else {
          self.handleRequest(payload, callback);
        }
      },

      handleRequest: function(payload, callback) {
        var result = "";

        // Fake out a request object
        var request = {
          body: payload,
          method: "POST",
          headers: {
            "content-type": "application/json"
          }
        };

        // Fake out a response object
        var response = {
          writeHead: function(statusCode, statusMessage, headers) {},
          write: function(chunk, encoding, cb) {
            result += chunk;
            if (typeof encoding == "function") cb = encoding;
            if (cb) cb();
          },
          end: function() {}
        };

        // Hack an express middleware function so jayson does all the JSON RPC niceties for us.
        // Note: jayson wants the payload parsed (i.e., non-stringified)
        middleware(request, response, function() {
          // Note: Errors are massaged into the result by the handler code.
          result = JSON.parse(result);
          callback(null, result);
        });
      }
    };

    return provider;
  },

  startServer: function(port, logger) {
    var self = this;

    if (port == null) {
      port = 8545;
    }

    if (logger == null) {
      logger = console;
    }

    var servicePort = port + 1;

    var server = this.server(logger);
    var http = server.http();
    http.listen(servicePort);

    var proxy = httpProxy.createProxyServer({target:'http://localhost:' + servicePort}).listen(port);

    // Proxy the request adding on our headers.
    proxy.on('proxyRes', function(proxyRes, req, res) {

      // Make OPTIONS requests okay.
      if (req.method == "OPTIONS") {
        proxyRes.statusCode = 200;
        proxyRes.statusMessage = "OK"
      }

      // Add access control headers to all requests.
      proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      proxyRes.headers['Access-Control-Allow-Methods'] = '*';
      proxyRes.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept';
    });

    proxy.on('error', function(error, req, res) {
      server.logger.log(error);
    });

    server.logger.log("EthereumJS TestRPC v" + pkg.version);

    server.manager.initialize(function(err, result) {
      server.logger.log("");
      server.logger.log("Available Accounts");
      server.logger.log("==================");

      var accounts = Object.keys(server.manager.blockchain.accounts);

      for (var i = 0; i < accounts.length; i++) {
        server.logger.log(accounts[i]);
      }

      server.logger.log("");
      server.logger.log("Listening on localhost:" + port);
    });
  }
}

module.exports = Server;
