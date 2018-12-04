// make sourcemaps work!
require('source-map-support/register')

module.exports = require("ganache-core/public-exports.js");
module.exports.version = require("ganache-core/package.json").version;
module.exports.to = require("ganache-core/lib/utils/to");
