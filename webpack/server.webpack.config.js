var path = require("path");
var fs = require("fs");
var OS = require("os");

var outputDir = path.join(__dirname, '..', 'build');
var outputFilename = 'server.node.js';

module.exports = {
  entry: './node_modules/ganache-core/lib/server.js',
  target: 'node',
  output: {
    path: outputDir,
    filename: outputFilename,
    library: "Server",
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  resolve: {
    alias: {
      "ws": path.join(__dirname, "..", "./nil.js"),
      "scrypt": "js-scrypt",
      "secp256k1": path.join(__dirname, "..", "node_modules", "secp256k1", "elliptic.js")
    }
  }
}
