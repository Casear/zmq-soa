(function() {
  var Client, logger, messages, zmq;

  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  Client = (function() {
    function Client() {
      var defaultTimeout, l, options;
      this._isConnect = false;
      this.done = false;
      this.service = '';
      this.defaultTimeout = 10000;
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
        this.ready();
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

    Client.prototype.onClientMessage = function(msg) {
      clearTimeout(this.timeout);
      this.done = true;
      if (this.callback) {
        this.callback(null, JSON.parse(msg.data));
        return delete this.callback;
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

    Client.prototype.ready = function() {
      if (this.service) {
        logger.info('worker: ' + this.service + ' ready');
        if (!this.connected) {
          this.socket.send(new messages.worker.ReadyMessage(this.service).toFrames());
          return this.connected = true;
        } else {
          return logger.warn('worker is already connected to the broker');
        }
      } else {
        logger.info('client: ready');
        if (!this.connected) {
          this.socket.send(new messages.client.ReadyMessage().toFrames());
          return this.connected = true;
        } else {
          return logger.warn('client is already connected to the broker');
        }
      }
    };

    Client.prototype.send = function(service, msg, callback, timeout) {
      this.callback = callback;
      logger.debug('client : sending ' + msg);
      if (this.connected) {
        if (this.callback) {
          this.socket.send(new messages.client.RequestMessage(service, JSON.stringify(msg)).toFrames());
        } else {
          this.socket.send(new messages.client.RequestNoRMessage(service, JSON.stringify(msg)).toFrames());
        }
        logger.debug('client : sent ' + msg);
        if (this.callback) {
          return this.timeout = setTimeout((function() {
            if (!this.done) {
              logger.error('client sending timeout. service:' + service + ' message:' + msg);
              this.callback(new Error('timeout'));
            }
            return delete this.callback;
          }).bind(this), timeout || this.defaultTimeout);
        }
      } else {
        logger.error('client disconnected ');
        if (this.callback) {
          return this.callback(new Error('disconnected'));
        }
      }
    };

    return Client;

  })();

  module.exports = {
    Client: Client
  };

}).call(this);
