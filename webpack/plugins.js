const { IgnorePlugin } = require("webpack");
const WebpackOnBuildPlugin = require("on-build-webpack");
const { EOL } = require("os");
const { chmodSync, existsSync } = require("fs");
const { join } = require("path");

const prependFile = require("prepend-file");
module.exports = (outputDir, outputFilename) => {
  return [
    // ignore these plugins completely
    new IgnorePlugin(/^(?:electron|ws)$/),

    // Put the shebang back on and make sure it's executable.
    new WebpackOnBuildPlugin(function () {
      const outputFile = join(outputDir, outputFilename);
      if (existsSync(outputFile)) {
        prependFile.sync(outputFile, "#!/usr/bin/env node" + EOL);
        chmodSync(outputFile, "755");
      }
    })
  ];
};