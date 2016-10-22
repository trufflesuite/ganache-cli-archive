var path = require('path');
var webpack = require('webpack');


var config = module.exports = {
     entry: './main.js',
     output: {
         path: './',
         filename: 'main.bundle.js',
     },
     resolve: {
       extensions: ['', '.js', '.jsx', 'index.js', 'index.jsx', '.json', 'index.json']
     },
     module: {
       preLoaders: [{
         test: /\.json$/,
         loader: 'json'
       }],
       loaders: [{
         test: /\.js$/,
         exclude: /node_modules/,
         loader: 'babel-loader',
         query: {
           presets: ['es2015']
         }
       }]
     },
     devServer: { inline: true }
 }
