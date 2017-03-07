var LevelUpArrayAdapter = require("./database/leveluparrayadapter");
var LevelUpObjectAdapter = require("./database/levelupobjectadapter");
var levelup = require('level-browserify')
var Block = require("ethereumjs-block");
var txserializer = require("./database/txserializer");
var blockserializer = require("./database/blockserializer");
var BlockLogsSerializer = require("./database/blocklogsserializer");
var ReceiptSerializer = require("./database/receiptserializer");
var to = require("./utils/to");
var utils = require("ethereumjs-util");
var FakeTransaction = require('ethereumjs-tx/fake.js');
var tmp = require("tmp");

function Database(options) {
  this.options = options;
};

Database.prototype.initialize = function(callback) {
  var self = this;

  var db_options = {
    valueEncoding: "json"
  };

  if (this.options.db_path) {
    levelup(this.options.db_path, db_options, finishInitializing);
  } else {
    tmp.dir(function(err, tmpDir) {
      if (err) return callback(err);
      db = levelup(tmpDir, db_options, finishInitializing);
    });
  }

  function finishInitializing(err, db) {
    if (err) return callback(err);

    self.db = db;

    self.blocks               = new LevelUpArrayAdapter("blocks", self.db, blockserializer);
    self.blockLogs            = new LevelUpArrayAdapter("blockLogs", self.db, new BlockLogsSerializer(self));
    self.blockHashes          = new LevelUpObjectAdapter("blockHashes", self.db);
    self.transactions         = new LevelUpObjectAdapter("transactions", self.db, txserializer);
    self.transactionReceipts  = new LevelUpObjectAdapter("transactionReceipts", self.db, new ReceiptSerializer(self));

    callback();
  };
};

Database.prototype.close = function(callback) {
  this.db.close(callback);
};

module.exports = Database;
