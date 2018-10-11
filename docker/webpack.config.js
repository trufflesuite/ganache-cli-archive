const { EOL } = require("os");
const { chmodSync, existsSync } = require("fs");
const { join, resolve } = require("path");
const { IgnorePlugin } = require("webpack");
const WebpackOnBuildPlugin = require("on-build-webpack");
const prependFile = require("prepend-file");

const outputDir = resolve(__dirname, "build");
const outputFilename = "ganache.core.cli.js";
module.exports = {
  entry: [
    "./cli.js"
  ],
  target: "node",
  output: {
    path: outputDir,
    filename: outputFilename,
    library: "Ganache-Cli",
    libraryTarget: "umd",
    umdNamedDefine: true
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "shebang-loader"
      },
      {
        test: /(scrypt|\.node)$/,
        use: "node-loader"
      }
    ]
  },
  resolve: {
    alias: {
      "./build/Release/scrypt": "./build/Release/scrypt.node",
    }
  },
  plugins: [
    // ignore these plugins completely
    new IgnorePlugin(/^(?:electron|ws)$/),

    // Put the shebang back on and make sure it's executable.
    new WebpackOnBuildPlugin(function() {
      const outputFile = join(outputDir, outputFilename);
      if (existsSync(outputFile)) {
        prependFile.sync(outputFile, "#!/usr/bin/env node" + EOL);
        chmodSync(outputFile, "755");
      }
    })
  ],
  mode: "production"
};