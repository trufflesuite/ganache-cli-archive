var Sublevel = require("level-sublevel");

function LevelUpObjectAdapter(name, db, serializer) {
  this.db = Sublevel(db);
  this.db = this.db.sublevel(name);
  this.name = name;
  this.serializer = serializer || {
    encode: function(val, callback) { callback(null, val); },
    decode: function(val, callback) { callback(null, val); }
  };
};

LevelUpObjectAdapter.prototype.get = function(key, callback) {
  var self = this;

  this.db.get(key, function(err, val) {
    if (err) return callback(err);

    self.serializer.decode(val, callback);
  });
};

LevelUpObjectAdapter.prototype.set = function(key, value, callback) {
  var self = this;
  this.serializer.encode(value, function(err, encoded) {
    if (err) return callback(err);
    self.db.put(key, encoded, callback);
  });
};

LevelUpObjectAdapter.prototype.del = function(key, callback) {
  this.db.del(key, callback);
}

module.exports = LevelUpObjectAdapter;
