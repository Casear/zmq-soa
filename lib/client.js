(function() {
  var Client, crypto, logger, messages, zmq;

  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  crypto = require('crypto');

  Client = (function() {
    function Client() {
      var defaultTimeout, l, options;
      this._isConnect = false;
      this.done = false;
      this.service = '';
      this.defaultTimeout = 10000;
      this.callback = {};
      this.callbackTimeout = {};
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
            options = arguments[1];
          }
        } else if (l === 3) {
          options = arguments[1];
          if (arguments[2] && typeof arguments[2] === 'function') {
            this.workerCallback = arguments[2];
          }
        }
        if (options.service) {
          this.service = options.service;
        }
        if (options.timeout) {
          defaultTimeout = options.timeout;
        }
        this.ready(options.info);
      }
    }

    Client.prototype.onMsg = function() {
      var msg;
      logger.debug('worker get message');
      logger.debug(arguments);
      msg = messages.fromFrames(arguments, false);
      logger.debug(msg);
      if (msg instanceof messages.client.ResponseMessage) {
        logger.debug('client get response message');
        return this.onClientMessage(msg);
      } else if (msg instanceof messages.worker.ReadyMessage) {
        logger.debug('worker need to send ready message');
        return ready();
      } else if (msg instanceof messages.worker.RequestMessage) {
        logger.debug('worker get request message');
        return this.onWorkerMessage(msg);
      } else if (msg instanceof messages.worker.DisconnectMessage) {
        logger.debug('worker get disconnected message');
        return this.onDisconnect(msg);
      } else if (msg instanceof messages.worker.HeartbeatMessage) {
        logger.debug('worker get heartbeat message');
        return this.onHeartbeat(msg);
      } else {
        return logger.error('invalid request');
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
      console.log('connected:' + this.connected);
      return setTimeout((function() {
        if (worker) {
          this.socket.send(new messages.worker.HeartbeatMessage().toFrames());
        } else {
          this.socket.send(new messages.client.HeartbeatMessage().toFrames());
        }
        if (this.conneted) {
          return this.disconnected = setTimeout((function() {
            return this.conneted = false;
          }).bind(this), 15000);
        }
      }).bind(this), 10000);
    };

    Client.prototype.onClientMessage = function(msg) {
      var hex;
      hex = msg.envelope.toString('hex');
      if (msg.envelope && this.callback[hex]) {
        this.callback[hex](null, JSON.parse(msg.data));
        delete this.callback[hex];
        return delete this.callbackTimeout[hex];
      }
    };

    Client.prototype.onWorkerMessage = function(msg) {
      var cb;
      logger.debug('onWorkerMessage');
      if (this.workerCallback) {
        logger.debug('run workerCallback');
        cb = function(returnMsg) {
          var r;
          r = new messages.worker.ResponseMessage(msg.service, JSON.stringify(returnMsg));
          return this.socket.send(r.toFrames());
        };
        return this.workerCallback(JSON.parse(msg.data), cb.bind(this));
      }
    };

    Client.prototype.ready = function(data) {
      if (this.service) {
        logger.info('worker: ' + this.service + ' ready');
        if (!this.connected) {
          logger.warn('worker send ready message');
          this.socket.send(new messages.worker.ReadyMessage(this.service, JSON.stringify(data)).toFrames());
          return this.socket.send(new messages.worker.HeartbeatMessage().toFrames());
        } else {
          return logger.warn('worker is already connected to the broker');
        }
      } else {
        logger.info('client: ready');
        if (!this.connected) {
          this.socket.send(new messages.client.ReadyMessage().toFrames());
          return this.socket.send(new messages.client.HeartbeatMessage().toFrames());
        } else {
          return logger.warn('client is already connected to the broker');
        }
      }
    };

    Client.prototype.send = function(service, msg, callback, timeout) {
      return crypto.randomBytes(4, (function(ex, buf) {
        var hex;
        logger.debug('client : sending ' + msg + ' connected:' + this.connected);
        if (this.connected) {
          if (callback) {
            this.socket.send(new messages.client.RequestMessage(service, JSON.stringify(msg), buf).toFrames());
          } else {
            this.socket.send(new messages.client.RequestNoRMessage(service, JSON.stringify(msg), buf).toFrames());
          }
          logger.debug('client : sent ' + msg);
          if (callback) {
            hex = buf.toString('hex');
            this.callback[hex] = callback;
            return this.callbackTimeout[hex] = setTimeout((function() {
              if (this.callback[hex]) {
                logger.error('client sending timeout. service:' + service + ' message:' + msg);
                this.callback[buf.toString('hex')]('response timeout');
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
      }).bind(this));
    };

    return Client;

  })();

  module.exports = {
    Client: Client
  };

}).call(this);
