(function() {
  var Broker, message, redis, zmq,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  redis = require('redis');

  zmq = require('zmq');

  message = require('./message');

  Broker = (function(_super) {
    __extends(Broker, _super);

    Broker.prototype.service = {};

    Broker.prototype.workers = 0;

    Broker.prototype.queue = [];

    function Broker(endpoint, options) {
      this.socket = zmq.socket('router');
      this.socket.bindSync(endpoint);
      this.socket.on('message', this.onMessage.bind(this));
    }

    Broker.prototype.onMessage = function() {};

    Broker.prototype.onWorkerReady = function(message, envelope) {};

    Broker.prototype.onWorkerDisconnect = function() {};

    Broker.prototype.disconnectWorker = function(envelope) {
      return this.socket.send(new messages.worker.DisconnectMessage(envelope).toFrames());
    };

    Broker.prototype.disconnect = function() {};

    return Broker;

  })(EventEmitter);

}).call(this);
