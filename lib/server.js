var jayson = require("jayson");
var Manager = require('./manager.js');
var Provider = require('./provider.js');
var httpProxy = require('http-proxy');
var pkg = require("../package.json");

var manager = new Manager();

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

var createHandler = function(method) {
  var fn = manager[method];

  var wrapped = function() {
    console.log(method);
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
};

Server = {
  startServer: function(port) {

    if (port == null) {
      port = 8101;
    }

    var servicePort = port + 1;

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
      'eth_getTransactionByHash',
      'eth_getTransactionCount',
      'eth_getTransactionReceipt',
      'eth_newBlockFilter',
      'eth_sendTransaction',
      'eth_sendRawTransaction',
      'eth_uninstallFilter',
      'web3_clientVersion'
    ];

    var functions = {};

    methods.forEach(function(method) {
      functions[method] = createHandler(method);
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
      console.log(error);
    });

    console.log("EtherSim v" + pkg.version);

    manager.initialize(function(err, result) {
      console.log("");
      console.log("Available Accounts");
      console.log("==================");

      var accounts = Object.keys(manager.blockchain.accounts);

      for (var i = 0; i < accounts.length; i++) {
        console.log(accounts[i]);
      }

      console.log("");
      console.log("Listening on localhost:" + port);
    });
  }
}

module.exports = Server;
