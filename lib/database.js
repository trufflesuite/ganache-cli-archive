var LevelUpArrayAdapter = require("./database/leveluparrayadapter");
var LevelUpObjectAdapter = require("./database/levelupobjectadapter");
var levelup = require('level-browserify');
var Sublevel = require("level-sublevel");
var Block = require("ethereumjs-block");
var txserializer = require("./database/txserializer");
var blockserializer = require("./database/blockserializer");
var bufferserializer = require("./database/bufferserializer");
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

    // Blocks, keyed by array index (not necessarily by block number) (0-based)
    self.blocks = new LevelUpArrayAdapter("blocks", self.db, blockserializer);

    // Logs triggered in each block, keyed by block id (ids in the blocks array; not necessarily block number) (0-based)
    self.blockLogs = new LevelUpArrayAdapter("blockLogs", self.db, new BlockLogsSerializer(self));

    // Block hashes -> block ids (ids in the blocks array; not necessarily block number) for quick lookup
    self.blockHashes = new LevelUpObjectAdapter("blockHashes", self.db);

    // The state roots after each block was saved; each state root is keyed by the block number
    // and represents the state after that block was added to the chain.
    self.blockRoots = new LevelUpArrayAdapter("blockRoots", self.db, bufferserializer);

    // Transaction hash -> transaction objects
    self.transactions = new LevelUpObjectAdapter("transactions", self.db, txserializer);

    // Transaction hash -> transaction receipts
    self.transactionReceipts = new LevelUpObjectAdapter("transactionReceipts", self.db, new ReceiptSerializer(self));

    // A place to store the trie's data with the default encoding and not json encoded.
    self.trie_db = Sublevel(db).sublevel("trie_db", {
      valueEncoding: 'utf8'
    });

    callback();
  };
};

Database.prototype.close = function(callback) {
  this.db.close(callback);
};

module.exports = Database;
