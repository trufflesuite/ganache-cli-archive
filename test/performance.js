// var TestRPC = require("../");
// var async = require("async");
// var Web3 = require("web3");
// var assert = require("chai").assert;
//
// describe("Performance", function() {
//   var provider;
//   var accounts;
//   var web3 = new Web3();
//
//   before("create provider", function() {
//     provider = TestRPC.provider();
//     web3.setProvider(provider);
//   });
//
//   before("get accounts", function(done) {
//     web3.eth.getAccounts(function(err, accs) {
//       if (err) return done(err);
//       accounts = accs;
//       done();
//     });
//   });
//
//   function runTest(times, fn, callback) {
//     var start = new Date();
//
//     async.timesSeries(times, fn, function(err) {
//       if (err) return callback(err);
//
//       var end = new Date();
//       var actualTime = end.getTime() - start.getTime();
//
//       callback(null, actualTime);
//     });
//   }
//
//   function runAverage(title, number_of_runs, fn_times, fn, callback) {
//     var results = new Array(number_of_runs);
//
//     async.timesSeries(number_of_runs, function(n, next) {
//       process.stdout.write("    " + title + " " + (n + 1) + "...");
//
//       runTest(fn_times, fn, function(err, totalTime) {
//         if (err) return next(err);
//         results[n] = totalTime;
//
//         console.log((totalTime / 1000) + " seconds");
//         next();
//       });
//     }, function(err) {
//       if (err) return callback(err);
//
//       var sum = results.reduce(function(a, b) {
//         return a + b;
//       }, 0);
//
//       var average = sum / number_of_runs;
//
//       console.log("    Average " + (average / 1000) + " seconds");
//
//       callback(null, average);
//     });
//   };
//
//   it("doesn't significantly change in speed", function(done) {
//     this.timeout(120000);
//
//     // The benchmark is designed to take about a 10th as long as the actual
//     // performance test. In order to write a test that runs on any machine,
//     // We'll assert that the relative performance difference remains the same,
//     // so that we're not asserting specific lengths of time that will fail on
//     // slower (and faster) machines.
//     runAverage("Running benchmark", 10, 60000, function(n, cb) {
//       web3.sha3(Math.random());
//       cb();
//     }, function(err, averageBenchmarkTime) {
//       if (err) return done(err);
//
//       console.log("");
//
//       var expectedTime = 10000;
//       var times = 1000;
//
//       runAverage("Running performance test", 4, 1000, function(n, cb) {
//         web3.eth.sendTransaction({
//           from: accounts[0],
//           to: accounts[1],
//           value: 500, // wei
//           gas: 90000
//         }, cb);
//       }, function(err, averageTestTime) {
//         if (err) return done(err);
//
//         var allowedDifference = 0.1; // Allow a 10 percent difference.
//
//         // put averageBenchmarkTime in relative units to averageTestTime
//         averageBenchmarkTime *= 10;
//
//         var difference = averageTestTime - averageBenchmarkTime;
//         var differencePercent = Math.abs(difference) / averageBenchmarkTime;
//
//         console.log("");
//         console.log("    Percent difference relative to benchmark: " + parseInt(differencePercent * 100) + "%");
//
//         if (differencePercent > allowedDifference) {
//           if (difference < 0) {
//             assert.fail("Performance increased by " + parseInt(differencePercent * 100) + " percent! Everything okay?")
//           } else {
//             assert.fail("Performance decreased by " + parseInt(differencePercent * 100) + " percent!")
//           }
//         }
//
//         done();
//       });
//
//     });
//   });
// });
