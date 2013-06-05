(function() {
  var Client, message, zmq;

  zmq = require('zmq');

  message = require('./message');

  Client = (function() {
    function Client() {
      var defaultTimeout, l, options;
      this._isConnect = false;
      this.done = false;
      this.service = '';
      this.defaultTimeout = 5000;
      l = arguments.length;
      if (l > 3 || l < 1) {
        this.socket = zmq.socket('dealer');
        this.socket.connect(arguments[0]);
        this.socket.on('message', this.onMsg.bind(this));
        if (l === 2) {
          if (arguments[1] && getClass.call(arguments[1]) === '[object Function]') {
            this.workerCallback = arguments[1];
          } else {
            options = arguments[1];
          }
        } else if (l === 3) {
          options = arguments[1];
          if (arguments[2] && getClass.call(arguments[2]) === '[object Function]') {
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
      msg = message.fromFrames(arguments);
      if (msg instanceof message.client.ResponseMessage) {
        return this.onClientMessage(msg);
      } else if (message instanceof messages.worker.RequestMessage) {
        return this.onWorkerMessage(msg);
      } else if (message instanceof messages.worker.DisconnectMessage) {
        return this.onDisconnect(message);
      } else if (message instanceof messages.worker.DisconnectMessage) {
        return this.onHeartbeat(message);
      } else {
        return console.log('invalid request');
      }
    };

    Client.prototype.onDisconnect = function() {
      console.log('received disconnect request');
      this.socket.disconnect(this.socket.last_endpoint);
      return this.connected = false;
    };

    Client.prototype.onClientMessage = function(msg) {
      clearTimeout(this.timeout);
      this.done = true;
      return this.callback(null, JSON.parse(msg.data));
    };

    Client.prototype.onWorkerMessage = function(msg) {};

    Client.prototype.ready = function() {
      if (!this.connected) {
        this.socket.send(new message.worker.ReadyMessage(this.service).toFrames());
        return this.connected = true;
      } else {
        return console.log('worker is already connected to the broker');
      }
    };

    Client.prototype.send = function(service, msg, callback, timeout) {
      this.callback = callback;
      if (!this.connected) {
        this.socket.send(new message.client.RequestMessage(service, JSON.stringify(data)).toFrames());
        return this.timeout = setTimeout((function() {
          if (!this.done) {
            this.callback(new Error('timeout'));
          }
          return delete this.callback;
        }).bind(this), timeout || defaultTimeout);
      }
    };

    return Client;

  })();

  modules["export"] = {
    Client: Client
  };

}).call(this);
