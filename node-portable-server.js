var fs = require('fs');
var browserify = require('browserify');
var insertGlobals = require('insert-module-globals');

browserify('./bin/testrpc', {
    builtins: false,
    commondir: false,
    
    insertGlobalVars: {
        __filename: insertGlobals.vars.__filename,
        __dirname: insertGlobals.vars.__dirname,
        process: function() {
            return;
        },
    },
    browserField: true,
}).bundle().pipe(fs.createWriteStream('./build/testrpc-portable.js'));