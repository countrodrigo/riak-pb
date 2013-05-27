var Duplex = require('stream').Duplex;
var extend = require('util')._extend;
var test = require('tap').test;
var Client = require('../dumb_client');

test('it connects from pool', function(t) {

  var mockConnection = new Duplex({objectMode: true});
  mockConnection._write = function(o, encoding, cb) {
    o = JSON.parse(o);
    o.done = true;
    this.push(JSON.stringify(o));
    cb();
  };

  mockConnection._read = function() {};

  mockConnection.destroy = function() {};

  var mockProtocol = {
    parse: function() {
      var parser = new Duplex({objectMode: true});

      parser._write = function(b, encoding, cb) {
        this.push(JSON.parse(b));
        cb(null);
      };

      parser._read = function() {};

      parser.expectMultiple = function(v) {};

      parser.destroy = function() {};

      parser.cleanup = function() {};

      return parser;

    },
    serialize: function(o) {
      return JSON.stringify(o);
    },
    merge: extend
  };

  var mockPool = {
    connect: function() {
      return mockConnection;
    }
  };

  var client = Client({
    pool: mockPool,
    protocol: mockProtocol,
    nodes: [{host: 'localhost', port: 8087}]
  });

  var ret = client.write({payload: {a: 'WAT'}});

  var replyCount = 0;
  client.on('readable', function() {
    var buf;
    while (buf = client.read()) {
      replyCount ++;
      t.equal(replyCount, 1);
      t.deepEqual(buf, {a: 'WAT', done: true});
      t.end();
    }
  });

  t.strictEqual(ret, false);
});

test('it reconnects when the connection errors', function(t) {

  var connectCount = 0;

  var mockConnection = new Duplex({objectMode: true});
  mockConnection._write = function(o, encoding, cb) {
    if (connectCount < 2) {
      var error = new Error('Something awful has happened');
      error.code = 'ECONNREFUSED';
      mockConnection.emit('error', error);
      cb();
      return;
    }
    o = JSON.parse(o);
    o.done = true;
    this.push(JSON.stringify(o));
    cb();
  };

  mockConnection._read = function() {}

  mockConnection.destroy = function() {};

  var mockProtocol = {
    parse: function() {
      var parser = new Duplex({objectMode: true});

      parser._write = function(b, encoding, cb) {
        this.push(JSON.parse(b));
        cb(null);
      };

      parser._read = function() {};

      parser.expectMultiple = function(v) {};

      parser.destroy = function() {};

      parser.cleanup = function() {};

      return parser;

    },
    serialize: function(o) {
      return JSON.stringify(o);
    },
    merge: extend
  };

  var mockPool = {
    connect: function() {
      connectCount ++;
      return mockConnection;
    }
  };

  var client = Client({
    pool: mockPool,
    protocol: mockProtocol,
    nodes: [{host: 'localhost', port: 8087}]
  });

  var ret = client.write({payload: {a: 'WAT'}});

  var replyCount = 0;
  client.on('readable', function() {
    var buf;
    while (buf = client.read()) {
      replyCount ++;
      t.equal(replyCount, 1);
      t.deepEqual(buf, {a: 'WAT', done: true});
      t.equal(connectCount, 2);
      t.end();
    }
  });

  t.strictEqual(ret, false);
});