(function() {
  var Client, crypto, event, keySize, logger, messages, net, rsa, zmq,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };



  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  crypto = require('crypto');

  net = require('net');

  rsa = require('./rsaCrypto').rsaCrypto;

  event = require("events");

  keySize = 2048;

  Client = (function(_super) {
    __extends(Client, _super);

    function Client() {
      var defaultTimeout, l;
      this.connected = false;
      this.service = null;
      this.defaultTimeout = 10;
      this.callback = {};
      this.callbackTimeout = {};
      this.options = {};
      this.host = '';
      this.port = '';
      this.rsaPub = null;
      this.signer = null;
      this.isWorker = false;
      this.isReady = false;
      l = arguments.length;
      if (l <= 4 && l > 2) {
        this.socket = zmq.socket('dealer');
        this.host = arguments[0];
        this.port = arguments[1];
        logger.info("tcp://" + this.host + ":" + this.port + ' client connecting');
        this.socket.connect("tcp://" + this.host + ":" + this.port);
        this.socket.on('message', this.onMsg.bind(this));
        if (l === 3) {
          if (arguments[2] && typeof arguments[3] === 'function') {
            this.workerCallback = arguments[2];
          } else {
            this.options = arguments[2];
          }
        } else if (l === 4) {
          this.options = arguments[2];
          if (arguments[3] && typeof arguments[3] === 'function') {
            this.workerCallback = arguments[3];
          }
        }
        if (this.options.service) {
          this.service = this.options.service;
          this.isWorker = true;
        }
        if (this.options.timeout) {
          defaultTimeout = this.options.timeout;
        }
        this.TestReconnect();
      }
    }

    Client.prototype.onMsg = function() {
      var d, data, decipher, decrypted, ex, frames, msg, s;
      logger.debug('msg get');
      logger.debug(arguments);
      if (arguments.length === 2) {
        logger.debug('msg try to descrypt');
        s = new Buffer(arguments[1].toString(), 'base64');
        d = new Buffer(arguments[0].toString(), 'base64');
        if (this.rsaPub) {
          try {
            if (this.rsaPub.Verify(d, s)) {
              try {
                decipher = crypto.createDecipheriv('des3', this.key, this.iv);
                decrypted = decipher.update(d, 'binary', 'hex');
                decrypted += decipher.final('hex');
                data = new Buffer(decrypted, 'hex');
                msg = messages.fromJSON(JSON.parse(data.toString()));
                logger.debug('Decrypt Success');
              } catch (_error) {
                ex = _error;
                logger.error(ex);
                return;
              }
            } else {
              logger.debug('Signature failed');
              return;
            }
          } catch (_error) {
            ex = _error;
            logger.error(ex);
            return;
          }
        } else {
          logger.debug('msg is not Ready');
          return;
        }
      } else {
        msg = messages.fromFrames(arguments, false);
      }
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
      } else if (msg instanceof messages.client.HandshakeMessage) {
        logger.debug('client get auth message');
        return this.onHandshake(msg);
      } else if (msg instanceof messages.client.AuthMessage) {
        logger.debug('client get auth message');
        return this.onAuth(msg);
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
      } else if (msg instanceof messages.worker.HandshakeMessage) {
        logger.debug('worker get handshake message');
        return this.onHandshake(msg);
      } else if (msg instanceof messages.worker.AuthMessage) {
        logger.debug('worker get auth message');
        return this.onAuth(msg);
      } else {
        logger.error('client invalid request');
        logger.error(arguments);
        logger.error(msg);
        frames = Array.prototype.slice.call(arguments);
        return logger.error({
          protocol: frames[0] ? frames[0].toString('ascii') : "",
          type: frames[1] ? frames[1].readInt8(0) : "",
          service: frames[2] ? frames[2].toString() : "",
          mapping: frames[3],
          time: frames[4],
          data: frames[6] ? frames[6].toString() : ""
        });
      }
    };

    Client.prototype.sendHeartbeat = function() {
      logger.debug('Send Heartbeat');
      if (this.disconnected) {
        clearTimeout(this.disconnected);
      }
      if (this.isWorker) {
        this.socket.send(new messages.worker.HeartbeatMessage().toFrames());
      } else {
        this.socket.send(new messages.client.HeartbeatMessage().toFrames());
      }
      if (this.connected) {
        return this.disconnected = setTimeout((function() {
          this.connected = false;
          this.auth = false;
          logger.error('disconnected');
          this.emit('disconnect');
          return this.TestReconnect();
        }).bind(this), 20000);
      }
    };

    Client.prototype.onHeartbeat = function(worker) {
      logger.debug('worker : received heartbeat request');
      if (this.disconnected) {
        clearTimeout(this.disconnected);
      }
      if (!this.connected) {
        this.connected = true;
        this.emit('connect');
      }
      return setTimeout((function() {
        return this.sendHeartbeat();
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
        logger.debug(msg);
        cb = function(returnMsg) {
          var r;
          r = new messages.worker.ResponseMessage(msg.service, returnMsg, null, msg.mapping);
          return this.socket.send(r.toFrames());
        };
        return this.workerCallback(msg.data, cb.bind(this));
      }
    };

    Client.prototype.onAuth = function(msg) {
      logger.debug('Auth');
      if (msg.data) {
        logger.debug('Auth Success');
        if (!this.isAuth) {
          this.isAuth = true;
          return this.emit('authenticate');
        }
      } else {
        return logger.error('Auth Failed');
      }
    };

    Client.prototype.Authenticate = function(auth) {
      var data;
      logger.debug('Auth');
      data = {
        auth: auth,
        service: this.service
      };
      if (this.connected && !this.isAuth) {
        if (this.isWorker) {
          return this.SendWithEncrypt(new messages.worker.AuthMessage(new Buffer(JSON.stringify(data))));
        } else {
          return this.SendWithEncrypt(new messages.client.AuthMessage(new Buffer(JSON.stringify(data))));
        }
      }
    };

    Client.prototype.ready = function(data) {
      if (!this.connected) {
        this.connected = true;
        this.emit('connect');
      }
      if (!this.isReady) {
        this.isReady = true;
        this.emit('ready');
      }
      if (this.auth && !this.isAuth) {
        return this.Authenticate(this.auth);
      }
    };

    Client.prototype.onHandshake = function(msg) {
      var pub;
      logger.debug('');
      if (msg.data) {
        pub = msg.data.toString();
        if (this.rsaPub) {
          if (this.pubKey === this.isReady) {
            return;
          } else {
            logger.info("Change Key");
            this.rsaPub = new rsa(keySize, pub);
            this.pubKey = pub;
          }
        } else {
          logger.info("Initial Key");
          this.rsaPub = new rsa(keySize, pub);
          this.pubKey = pub;
        }
      } else {
        this.rsaPub = null;
      }
      logger.debug('Start Handshake');
      return this.Handshake();
    };

    Client.prototype.Handshake = function() {
      var content, tripleKey;
      if (this.rsaPub) {
        logger.info('Get Handshake Key');
        this.key = crypto.randomBytes(24);
        this.iv = crypto.randomBytes(8);
        this.signer = new rsa(2048);
        tripleKey = this.key.toString('base64') + ',' + this.iv.toString('base64') + ',' + this.signer.toPem(false) + ',' + (new Date()).getTime();
        content = this.rsaPub.Encrypt(new Buffer(tripleKey));
        if (this.service) {
          logger.info("Send Handshake DES Key");
          this.socket.send(new messages.worker.HandshakeMessage(content).toFrames());
          return this.sendHeartbeat();
        } else {
          logger.info("Send Handshake DES Key");
          this.socket.send(new messages.client.HandshakeMessage(content).toFrames());
          return this.sendHeartbeat();
        }
      } else {
        logger.info("Get Reconnect Command");
        return this.TestReconnect();
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
          this.socket.send(new messages.client.RequestMessage(service, msg, null, buf, timeout).toFrames());
        } else {
          this.socket.send(new messages.client.RequestNoRMessage(service, msg, null, timeout).toFrames());
        }
        logger.debug('client : sent ' + msg);
        if (callback) {
          hex = buf.toString('hex');
          this.callback[hex] = callback;
          logger.debug('timeout ' + (timeout || this.defaultTimeout) * 1000);
          return this.callbackTimeout[hex] = setTimeout((function() {
            if (this.callback[hex]) {
              logger.error('client sending timeout. service:' + service + ' message:' + msg);
              this.callback[hex]('response timeout');
            }
            delete this.callback[hex];
            return delete this.callbackTimeout[hex];
          }).bind(this), (timeout || this.defaultTimeout) * 1000);
        }
      } else {
        logger.error('client disconnected ');
        if (callback) {
          return callback('connect failed');
        }
      }
    };

    Client.prototype.SendWithEncrypt = function(msg) {
      var cipher, crypted, data, hash;
      console.dir(msg);
      cipher = crypto.createCipheriv('des3', this.key, this.iv);
      if (msg.data) {
        msg.data = msg.data.toString('base64');
      }
      console.dir(msg);
      crypted = cipher.update(JSON.stringify(msg), 'utf8', 'hex');
      crypted += cipher.final('hex');
      data = new Buffer(crypted, 'hex');
      hash = this.signer.Sign(data);
      return this.socket.send([data.toString('base64'), hash]);
    };

    Client.prototype.TestReconnect = function() {
      if (!this.connected) {
        return this.CheckNetwork((function(result) {
          if (result) {
            logger.debug("Connect IP and Port Correct");
            if (this.service) {
              logger.debug("start worker handshake");
              this.socket.send(new messages.worker.HandshakeMessage().toFrames());
            } else {
              logger.debug("start worker handshake");
              this.socket.send(new messages.client.HandshakeMessage().toFrames());
            }
            return setTimeout((function() {
              if (!this.connected) {
                logger.debug("start Reconnect");
                return this.TestReconnect();
              } else {
                return logger.debug("Already Connect");
              }
            }).bind(this), 20000);
          } else {
            logger.error('Connect IP and Port Failed');
            return setTimeout((function() {
              if (!this.connected) {
                return this.TestReconnect();
              }
            }).bind(this), 20000);
          }
        }).bind(this));
      }
    };

    Client.prototype.CheckNetwork = function(cb) {
      var client;
      client = net.connect({
        port: this.port,
        host: this.host
      }, function() {
        client.end();
        return cb(true);
      });
      return client.on('error', function() {
        return cb(false);
      });
    };

    return Client;

  })(event.EventEmitter);

  module.exports = {
    Client: Client
  };

}).call(this);
