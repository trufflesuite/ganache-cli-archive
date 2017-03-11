var path = require("path");
var fs = require("fs");

var solcBinDir = path.join(__dirname, "node_modules", "solc", "bin");

if (fs.existsSync(solcBinDir) == false) {
  fs.mkdirSync(solcBinDir);
}

module.exports = {
  entry: './index.js',
  target: 'node',
  output: {
    path: path.join(__dirname, 'build'),
    filename: 'node-lib.js',
    library: "TestRPC",
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  externals: [
    {
      "leveldown": "commonjs leveldown"
    }
  ],
  resolve: {
    alias: {
      "ws": path.join(__dirname, "./nil.js"),
      "scrypt": "js-scrypt",
      "secp256k1": path.join(__dirname, "node_modules", "secp256k1", "elliptic.js")
    }
  }
}
