var EventEmitter = require('events').EventEmitter;
var assert = require('assert');
var DumbClient = require('./dumb_client');
var PassThrough = require('stream').PassThrough;

module.exports =
function RiakClient(options) {
  var c = {};
  var queue = [];
  var busy = false;
  var ending = false;

  if (! options) options = {};

  var client = DumbClient(options);
  client.on('readable', clientOnReadable);
  client.on('error', clientOnError);


  function request(type, data, expectMultiple, callback) {
    queue.push({payload: {type: type, data: data}, expectMultiple: expectMultiple});
    queue.push(callback);
    flush();
  }

  function flush() {
    if (!busy) {
      if (queue.length) {
        busy = true;
        var args = queue.shift();
        client.write(args);
      } else if (ending) {
        // no more jobs in the queue
        // and we're ending
        // this is the time to say goodbye...
        client.destroy();
      }
    }
  }

  function clientOnReadable() {
    assert(busy, 'shouldnt get a readable when not waiting for response');
    var response = client.read();
    assert(response, 'should get a response when client is readable');
    var callback = queue.shift();
    assert(callback, 'need a callback in the queue');
    busy = false;
    callback(null, response);
    flush();
  }

  function clientOnError(err) {
    if (busy) {
      busy = false;
      var callback = queue.shift();
      if (callback) callback(err);
      else client.emit('error', err);
      flush();
    } else {
      client.emit('error', err);
    }
  }

  /// Disconnect

  c.disconnect =
  function disconnect() {
    ending = true;
    flush();
  };

  /// Client utility methods
  c.getBuckets = function getBuckets(callback) {
    request('RpbListBucketsReq', null, false, callback);
  };

  c.getBucket = function getBucket(params, callback) {
    request('RpbGetBucketReq', params, callback);
  }

  c.setBucket = function setBucket(params, callback) {
    request('RpbSetBucketReq', params, false, callback);
  }

  c.getKeys = function getKeys(params, callback) {
    var s = new PassThrough({objectMode: true});
    request(RpbListKeysReq, params, true, function(err) {
      if (err) {
        if (! callback) s.emit('error', err);
        else callback(err);
      }
    });
    client.pipe(s);
    client.once('done', function() {
      client.unpipe(s);
    });
    return s;
  };

  c.setClientId = function (params, callback) {
    request('RpbSetClientIdReq', params, false, callback);
  };


  c.getClientId = function(callback) {
    request('RpbGetClientIdReq', null, false, function(err, reply) {
      if (err) return callback(err);
      callback(null, reply.client_id);
    });
  };

  return c;
};

return;
RiakPBC.prototype.getKeys = function (params, streaming, callback) {
  if (typeof streaming === 'function') {
    callback = streaming;
    streaming = false;
  }

  if (streaming) {
    var emitter = new EventEmitter();
    this.makeRequest('RpbListKeysReq', params, callback, true, emitter);
    return emitter;
  } else {
    this.makeRequest('RpbListKeysReq', params, callback, true);
  }
};

RiakPBC.prototype.put = function (params, callback) {
  this.makeRequest('RpbPutReq', params, callback);
};

RiakPBC.prototype.get = function (params, callback) {
  this.makeRequest('RpbGetReq', params, callback);
};

RiakPBC.prototype.del = function (params, callback) {
  this.makeRequest('RpbDelReq', params, callback);
};

RiakPBC.prototype.mapred = function (params, streaming, callback) {
  if (typeof streaming === 'function') {
    callback = streaming;
    streaming = false;
  }

  if (streaming) {
    var emitter = new EventEmitter();
    this.makeRequest('RpbMapRedReq', params, callback, true, emitter);
    return emitter;
  } else {
    this.makeRequest('RpbMapRedReq', params, callback, true);
  }
};

RiakPBC.prototype.getIndex = function (params, callback) {
  this.makeRequest('RpbIndexReq', params, callback);
};

RiakPBC.prototype.search = function (params, callback) {
  this.makeRequest('RpbSearchQueryReq', params, callback);
};

RiakPBC.prototype.getClientId = function (callback) {
  this.makeRequest('RpbGetClientIdReq', null, callback);
};

RiakPBC.prototype.setClientId = function (params, callback) {
  this.makeRequest('RpbSetClientIdReq', params, callback);
};

RiakPBC.prototype.getServerInfo = function (callback) {
  this.makeRequest('RpbGetServerInfoReq', null, callback);
};

RiakPBC.prototype.ping = function (callback) {
  this.makeRequest('RpbPingReq', null, callback);
};

RiakPBC.prototype.connect = function (callback) {
  if (this.connected) return callback();
  var self = this;
  self.client.connect(self.port, self.host, function () {
    self.connected = true;
    callback();
  });
};

RiakPBC.prototype.disconnect = function () {
  if (!this.connected) return;
  this.client.end();
  this.connected = false;
  if (this.task) {
    this.queue.unshift(this.task);
    this.task = undefined;
  }
};

exports.createClient = function (options) {
  return new RiakPBC(options);
};