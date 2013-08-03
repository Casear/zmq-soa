(function() {
  var Client, crypto, logger, messages, zmq;



  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  crypto = require('crypto');

  Client = (function() {
    function Client() {
      var defaultTimeout, l;
      this.connected = false;
      this.service = '';
      this.defaultTimeout = 10000;
      this.callback = {};
      this.callbackTimeout = {};
      this.options = {};
      l = arguments.length;
      if (l <= 3 && l > 1) {
        this.socket = zmq.socket('dealer');
        logger.info(arguments[0] + ' client connecting');
        this.socket.connect(arguments[0]);
        this.socket.on('message', this.onMsg.bind(this));
        if (l === 2) {
          if (arguments[1] && typeof arguments[2] === 'function') {
            this.workerCallback = arguments[1];
          } else {
            this.options = arguments[1];
          }
        } else if (l === 3) {
          this.options = arguments[1];
          if (arguments[2] && typeof arguments[2] === 'function') {
            this.workerCallback = arguments[2];
          }
        }
        if (this.options.service) {
          this.service = this.options.service;
        }
        if (this.options.timeout) {
          defaultTimeout = this.options.timeout;
        }
        this.ready(this.options.info);
      }
      setInterval((function() {
        if (!this.connected) {
          return this.ready(this.options.info);
        }
      }).bind(this), 1000 * 3);
    }

    Client.prototype.onMsg = function() {
      var frames, msg;
      logger.debug('worker get message');
      logger.debug(arguments);
      msg = messages.fromFrames(arguments, false);
      logger.debug(msg);
      if (msg instanceof messages.client.ReadyMessage) {
        logger.debug('client get ready message');
        return this.ready(this.options);
      } else if (msg instanceof messages.client.ResponseMessage) {
        logger.debug('client get response message');
        return this.onClientMessage(msg);
      } else if (msg instanceof messages.client.HeartbeatMessage) {
        logger.debug('client get heartbeat message');
        return this.onHeartbeat(this.options.service);
      } else if (msg instanceof messages.worker.ReadyMessage) {
        logger.debug('worker need to send ready message');
        return this.ready(this.options);
      } else if (msg instanceof messages.worker.RequestMessage) {
        logger.debug('worker get request message');
        return this.onWorkerMessage(msg);
      } else if (msg instanceof messages.worker.DisconnectMessage) {
        logger.debug('worker get disconnected message');
        return this.onDisconnect(msg);
      } else if (msg instanceof messages.worker.HeartbeatMessage) {
        logger.debug('worker get heartbeat message');
        return this.onHeartbeat(this.options.service);
      } else {
        logger.error('client invalid request');
        logger.error(arguments);
        logger.error(msg);
        frames = Array.prototype.slice.call(arguments);
        return logger.error({
          protocol: frames[0].toString('ascii'),
          type: frames[1].readInt8(0),
          service: frames[2].toString(),
          mapping: frames[3],
          data: frames[5].toString()
        });
      }
    };

    Client.prototype.onDisconnect = function() {
      logger.info('worker : received disconnect request');
      this.socket.disconnect(this.socket.last_endpoint);
      return this.connected = false;
    };

    Client.prototype.onHeartbeat = function(worker) {
      logger.debug('worker : received heartbeat request');
      if (this.disconnected) {
        clearTimeout(this.disconnected);
      }
      this.connected = true;
      return setTimeout((function() {
        if (worker) {
          this.socket.send(new messages.worker.HeartbeatMessage().toFrames());
        } else {
          this.socket.send(new messages.client.HeartbeatMessage().toFrames());
        }
        if (this.connected) {
          return this.disconnected = setTimeout((function() {
            this.connected = false;
            return logger.error('disconnected');
          }).bind(this), 15000);
        }
      }).bind(this), 10000);
    };

    Client.prototype.onClientMessage = function(msg) {
      var hex;
      if (msg.mapping) {
        logger.debug('------------------mapping---------------');
        hex = msg.mapping.toString('hex');
        if (msg.mapping && this.callback[hex]) {
          logger.debug('------------------callback---------------');
          this.callback[hex](null, msg.data);
          delete this.callback[hex];
          return delete this.callbackTimeout[hex];
        } else {
          return logger.debug('------------------callback not found---------------');
        }
      } else {
        return logger.debug('------------------mapping not found---------------');
      }
    };

    Client.prototype.onWorkerMessage = function(msg) {
      var cb;
      logger.debug('onWorkerMessage');
      if (this.workerCallback) {
        logger.debug('run workerCallback');
        cb = function(returnMsg) {
          var r;
          r = new messages.worker.ResponseMessage(msg.service, returnMsg);
          return this.socket.send(r.toFrames());
        };
        return this.workerCallback(msg.data, cb.bind(this));
      }
    };

    Client.prototype.ready = function(data) {
      if (this.service) {
        logger.info('worker: ' + this.service + ' ready');
        if (!this.connected) {
          logger.warn('worker send ready message');
          if (this.disconnected) {
            clearTimeout(this.disconnected);
          }
          this.socket.send(new messages.worker.ReadyMessage(this.service, JSON.stringify(data)).toFrames());
          return this.socket.send(new messages.worker.HeartbeatMessage().toFrames());
        } else {
          return logger.warn('worker is already connected to the broker');
        }
      } else {
        logger.info('client: ready');
        if (!this.connected) {
          if (this.disconnected) {
            clearTimeout(this.disconnected);
          }
          this.socket.send(new messages.client.ReadyMessage().toFrames());
          return this.socket.send(new messages.client.HeartbeatMessage().toFrames());
        } else {
          return logger.warn('client is already connected to the broker');
        }
      }
    };

    Client.prototype.send = function(service, msg, callback, timeout) {
      var buf, hex, num;
      buf = new Buffer((function() {
        var _i, _results;
        _results = [];
        for (num = _i = 1; _i <= 5; num = ++_i) {
          _results.push(Math.floor(Math.random() * (128 - 1) + 0));
        }
        return _results;
      })());
      logger.debug('client : sending ' + msg + ' connected:' + this.connected);
      if (this.connected) {
        if (callback) {
          this.socket.send(new messages.client.RequestMessage(service, msg, null, buf).toFrames());
        } else {
          this.socket.send(new messages.client.RequestNoRMessage(service, msg, null).toFrames());
        }
        logger.debug('client : sent ' + msg);
        if (callback) {
          hex = buf.toString('hex');
          this.callback[hex] = callback;
          return this.callbackTimeout[hex] = setTimeout((function() {
            if (this.callback[hex]) {
              logger.error('client sending timeout. service:' + service + ' message:' + msg);
              this.callback[hex]('response timeout');
            }
            delete this.callback[hex];
            return delete this.callbackTimeout[hex];
          }).bind(this), timeout || this.defaultTimeout);
        }
      } else {
        logger.error('client disconnected ');
        if (callback) {
          return callback('connect failed');
        }
      }
    };

    return Client;

  })();

  module.exports = {
    Client: Client
  };

}).call(this);
