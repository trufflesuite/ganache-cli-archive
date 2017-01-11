var fs = require('fs');
var browserify = require('browserify');
var insertGlobals = require('insert-module-globals');

browserify('./index.js', {
    builtins: false,
    commondir: false,
    standalone: 'module',
    insertGlobalVars: {
        __filename: insertGlobals.vars.__filename,
        __dirname: insertGlobals.vars.__dirname,
        process: function() {
            return;
        },
    },
    browserField: true,
}).bundle().pipe(fs.createWriteStream('./build/ethereum-testrpc.js'));