(function() {
  var Broker, EventEmitter, crypto, fs, heartbeatTime, keySize, logger, messages, redis, rsa, ursa, zmq, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };



  redis = require('redis');

  zmq = require('zmq');

  fs = require('fs');

  crypto = require('crypto');

  messages = require('./message');

  logger = (require('./logger')).logger;

  EventEmitter = require('events').EventEmitter;

  rsa = require('./rsaCrypto').rsaCrypto;

  _ = require('underscore');

  ursa = require('ursa');

  heartbeatTime = 20000;

  keySize = 2048;

  Broker = (function(_super) {
    __extends(Broker, _super);

    function Broker(endpoint, options, log) {
      var keyContent;
      this.services = {};
      this.workers = {};
      this.clients = {};
      this.queue = [];
      this.mapping = {};
      this.rsaCrypto = {};
      this.pubKey = {};
      this.privKey = {};
      this.socket = zmq.socket('router');
      this.Auth = function(service, data, cb) {
        if (data.auth) {
          if (cb) {
            return cb(true, data);
          } else {
            return cb(false);
          }
        } else {
          return cb(false);
        }
      };
      if (log) {
        logger = log;
      }
      if (options.cert) {
        keyContent = fs.readFileSync(options.cert);
        this.rsaCrypto = new rsa(keySize, keyContent);
        this.pubKey = this.rsaCrypto.toPem(false);
        this.privKey = this.rsaCrypto.toPem(true);
      } else if (fs.existsSync('./key.pem')) {
        keyContent = fs.readFileSync('./key.pem');
        this.rsaCrypto = new rsa(keySize, keyContent);
        this.pubKey = this.rsaCrypto.toPem(false);
        this.privKey = this.rsaCrypto.toPem(true);
      }
      if (!ursa.isKey(this.pubKey)) {
        this.rsaCrypto = new rsa(keySize);
        this.pubKey = this.rsaCrypto.toPem(false);
        this.privKey = this.rsaCrypto.toPem(true);
        fs.writeFileSync('./key.pem', this.privKey);
      }
      logger.info("broker " + endpoint + 'starting');
      this.socket.bindSync(endpoint);
      logger.info("broker " + endpoint + ' started');
      this.socket.on('message', this.onMessage.bind(this));
      setImmediate(this.executeQueue.bind(this));
    }

    Broker.prototype.executeQueue = function() {
      var message, r, service, worker, worklabel;
      if (this.queue.length > 0) {
        message = this.queue.shift();
        logger.debug(message, 'executeQueue length:', this.queue.length);
        service = message.service.toString();
        logger.debug('request ' + service);
        if (this.services[service].worker > 0) {
          worker = this.services[service].waiting.shift();
          this.services[service].waiting.push(worker);
          if (message.mapping) {
            worklabel = message.mapping.toString('hex');
          }
          if (message instanceof messages.client.RequestMessage || message instanceof messages.client.RequestNoRMessage) {
            if (message instanceof messages.client.RequestMessage) {
              this.mapping[worklabel] = message;
              this.Timeout.bind(this)(worklabel, message.time * 1000);
            }
            r = new messages.worker.RequestMessage(service, message.data, new Buffer(worker, 'hex'), message.mapping, message.time).toFrames();
            this.socket.send(r);
          }
        } else {
          if (this.services[service]) {
            this.queue.push(message);
          }
        }
      }
      return setImmediate(this.executeQueue.bind(this));
    };

    Broker.prototype.Timeout = function(worklabel, time) {
      return setTimeout((function() {
        var clientEnvelope, mapEnvelope;
        if (this.mapping[worklabel]) {
          clientEnvelope = this.mapping[worklabel].envelope;
          mapEnvelope = this.mapping[worklabel].mapping;
          this.socket.send(new messages.client.ResponseMessage(this.mapping[worklabel].service, JSON.stringify({
            result: 0,
            err: '服務回應逾時'
          }), clientEnvelope, mapEnvelope).toFrames());
          logger.error(worklabel, " to ", this.mapping[worklabel].service.toString(), ' Timeout');
          return delete this.mapping[worklabel];
        }
      }).bind(this), time);
    };

    Broker.prototype.onMessage = function(envelope) {
      var d, data, decipher, decrypted, e, message, s;
      logger.debug('broker on Message');
      logger.debug(arguments);
      e = envelope.toString('hex');
      if (arguments.length === 3) {
        if (this.workers[e]) {
          logger.debug('worker try to descrypt');
          s = new Buffer(arguments[2].toString(), 'base64');
          d = new Buffer(arguments[1].toString(), 'base64');
          if (this.workers[e].isReady) {
            if (this.workers[e].s.Verify(d, s)) {
              decipher = crypto.createDecipheriv('des3', this.workers[e].k, this.workers[e].i);
              decrypted = decipher.update(d, 'binary', 'hex');
              decrypted += decipher.final('hex');
              data = new Buffer(decrypted, 'hex');
              message = messages.fromJSON(JSON.parse(data.toString()));
              logger.debug(data.toString());
              logger.debug(message);
              logger.debug('Decrypt Success');
            } else {
              logger.debug('Signature failed');
            }
          } else {
            logger.debug('Worker is not Ready');
          }
        } else if (this.clients[e]) {
          logger.debug('client try to descrypt');
          s = new Buffer(arguments[2].toString(), 'base64');
          d = new Buffer(arguments[1].toString(), 'base64');
          if (this.clients[e].isReady) {
            if (this.clients[e].s.Verify(d, s)) {
              decipher = crypto.createDecipheriv('des3', this.clients[e].k, this.clients[e].i);
              decrypted = decipher.update(d, 'binary', 'hex');
              decrypted += decipher.final('hex');
              data = new Buffer(decrypted, 'hex');
              message = messages.fromJSON(JSON.parse(data.toString()));
              logger.debug('Client Decrypt Success');
            } else {
              logger.debug('Client Signature failed');
            }
          } else {
            logger.debug('Clients is not Ready');
          }
        }
      } else {
        message = messages.fromFrames(arguments, true);
      }
      if (message) {
        if (message instanceof messages.client.Message) {
          if (message instanceof messages.client.RequestMessage || message instanceof messages.client.RequestNoRMessage) {
            logger.debug('broker: on client Request');
            return this.onClientRequest(message);
          } else if (message instanceof messages.client.ReadyMessage) {
            logger.debug('broker: on client Ready');
            return this.onClientReady(envelope);
          } else if (message instanceof messages.client.HeartbeatMessage) {
            logger.debug('broker: on client Heartbeat');
            return this.onClientHeartBeat(envelope);
          } else if (message instanceof messages.client.HandshakeMessage) {
            logger.debug('broker: on client HandShake');
            return this.onClientHandshake(message, envelope);
          } else if (message instanceof messages.client.AuthMessage) {
            logger.debug('broker: on client Auth');
            return this.onClientAuth(message, envelope);
          }
        } else if (message instanceof messages.worker.Message) {
          if (message instanceof messages.worker.ReadyMessage) {
            logger.debug('broker: on worker Ready');
            return this.onWorkerReady(message, envelope);
          } else if (message instanceof messages.worker.HeartbeatMessage) {
            logger.debug('broker: on worker heartbeat');
            return this.onWorkerHeartBeat(message, envelope);
          } else if (message instanceof messages.worker.ResponseMessage) {
            logger.debug('broker: on worker Response');
            return this.onWorkerResponse(message, envelope);
          } else if (message instanceof messages.worker.DisconnectMessage) {
            logger.debug('broker: on worker Disconnect');
            return this.onWorkerDisconnect(message);
          } else if (message instanceof messages.worker.HandshakeMessage) {
            logger.debug('broker: on worker Handshake');
            return this.onWorkerHandshake(message, envelope);
          } else if (message instanceof messages.worker.AuthMessage) {
            logger.debug('broker: on worker Auth');
            return this.onWorkerAuth(message, envelope);
          }
        } else {
          logger.error('broker invalid request');
          logger.error(arguments);
          return logger.error(message);
        }
      } else {
        logger.error('broker invalid request');
        logger.error(arguments);
        return logger.error(message);
      }
    };

    Broker.prototype.onClientReady = function(envelope) {
      var e;
      logger.info('client connect');
      e = envelope.toString('hex');
      if (!this.clients[e]) {
        this.clients[e] = {};
        return this.clients[e].checkHeartbeat = setTimeout((function() {
          if (this.clients[e]) {
            return delete this.clients[e];
          }
        }).bind(this), heartbeatTime);
      }
    };

    Broker.prototype.onClientHeartBeat = function(envelope) {
      var e;
      logger.debug('client  heartbeat');
      e = envelope.toString('hex');
      if (this.clients[e]) {
        clearTimeout(this.clients[e].checkHeartbeat);
        this.clients[e].checkHeartbeat = setTimeout((function() {
          return delete this.clients[e];
        }).bind(this), heartbeatTime);
        return this.socket.send(new messages.client.HeartbeatMessage(envelope).toFrames());
      } else {
        return this.socket.send(new messages.client.ReadyMessage(null, null, envelope).toFrames());
      }
    };

    Broker.prototype.onWorkerHeartBeat = function(message, envelope) {
      var e;
      logger.debug('worker  heartbeat');
      e = envelope.toString('hex');
      if (this.workers[e]) {
        clearTimeout(this.workers[e].checkHeartbeat);
        this.workers[e].checkHeartbeat = setTimeout((function() {
          var index;
          if (this.workers[e]) {
            if (this.services[this.workers[e].service]) {
              index = _.indexOf(this.services[this.workers[e].service].waiting, e);
              while (index !== -1) {
                this.services[this.workers[e].service].waiting.splice(index, 1);
                this.services[this.workers[e].service].worker--;
                index = _.indexOf(this.services[this.workers[e].service].waiting, e);
              }
            }
            return delete this.workers[e];
          }
        }).bind(this), heartbeatTime);
        return this.socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames());
      } else {
        logger.error('Worker isnt exist');
        return setTimeout((function() {
          if (!this.workers[e]) {
            logger.debug('Heartbeat Send Handshake');
            return this.socket.send(new messages.worker.HandshakeMessage(null, null, envelope).toFrames());
          } else {
            return this.socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames());
          }
        }).bind(this), 5000);
      }
    };

    Broker.prototype.onClientRequest = function(message) {
      var clientEnvelope, mapEnvelope;
      if (this.services.hasOwnProperty(message.service.toString())) {
        this.queue.push(message);
        return logger.info(message.envelope.toString('hex'), " to ", message.service.toString());
      } else {
        clientEnvelope = message.envelope;
        mapEnvelope = message.mapping;
        this.socket.send(new messages.client.ResponseMessage(message.service, JSON.stringify({
          result: 0,
          err: '服務不存在'
        }), clientEnvelope, mapEnvelope).toFrames());
        return logger.info(message.envelope.toString('hex'), " to ", message.service + " not exist");
      }
    };

    Broker.prototype.onWorkerResponse = function(message, envelope) {
      var clientEnvelope, mapEnvelope, workerlabel;
      logger.debug('onWorkerResponse');
      logger.debug(this.mapping);
      if (message.mapping) {
        workerlabel = message.mapping.toString('hex');
        if (this.mapping[workerlabel]) {
          clientEnvelope = this.mapping[workerlabel].envelope;
          mapEnvelope = this.mapping[workerlabel].mapping;
          delete this.mapping[workerlabel];
          this.socket.send(new messages.client.ResponseMessage(message.service, message.data, clientEnvelope, mapEnvelope).toFrames());
          return logger.info(workerlabel, " to ", message.service.toString(), ' return');
        } else {
          return logger.debug('onWorkerResponse without response');
        }
      }
    };

    Broker.prototype.onWorkerInfo = function(message, envelope) {
      var d, desKey, e, service;
      logger.debug(message);
      service = message.service.toString();
      logger.debug('on service:' + service + ' register');
      e = envelope.toString('hex');
      if (!this.services.hasOwnProperty(service)) {
        this.services[service] = {
          waiting: [],
          worker: 0
        };
      }
      if (message.data) {
        logger.debug(message.data.toString());
        try {
          d = this.rsaCrypto.Decrypt(message.data);
          desKey = d.toString();
          return this.workers[e] = JSON.parse(message.data.toString());
        } catch (_error) {

        }
      } else {
        return this.workers[e] = {};
      }
    };

    Broker.prototype.onWorkerReady = function(message, envelope) {};

    Broker.prototype.onWorkerAuth = function(message, envelope) {
      var ex;
      if (message.data) {
        logger.debug('Worker auth');
        try {
          return this.Auth(service, JSON.parse(message.data.toString()), function(result, data) {
            var e;
            if (result) {
              logger.info('Worker：' + service + ' Registration');
              e = envelope.toString('hex');
              if (this.workers[e]) {
                this.workers[e].service = service;
                if (_.indexOf(this.services[service].waiting, e) === -1) {
                  this.services[service].worker++;
                  this.services[service].waiting.push(e);
                }
              }
              return this.SendWithEncrypt(new messages.worker.AuthMessage(data, envelope));
            } else {
              return this.SendWithEncrypt(new messages.worker.AuthMessage('', '', envelope));
            }
          });
        } catch (_error) {
          ex = _error;
          return this.SendWithEncrypt(new messages.worker.AuthMessage('', '', envelope));
        }
      }
    };

    Broker.prototype.onClientAuth = function(message, envelope) {
      var ex;
      logger.debug(message.data.toString());
      try {
        return this.Auth(service, JSON.parse(message.data.toString()), function(result, data) {
          var e;
          if (result) {
            logger.info('Worker：' + service + ' Registration');
            e = envelope.toString('hex');
            if (this.workers[e]) {
              this.workers[e].service = service;
              if (_.indexOf(this.services[service].waiting, e) === -1) {
                this.services[service].worker++;
                this.services[service].waiting.push(e);
              }
            }
            return this.SendWithEncrypt(new messages.worker.AuthMessage(data, envelope));
          } else {
            return this.SendWithEncrypt(new messages.worker.AuthMessage('', '', envelope));
          }
        });
      } catch (_error) {
        ex = _error;
        return this.SendWithEncrypt(new messages.worker.AuthMessage('', '', envelope));
      }
    };

    Broker.prototype.onWorkerHandshake = function(message, envelope) {
      var d, desKey, e, sendTick, tick;
      if (!message.data) {
        logger.debug('send Handshake');
        this.socket.send(new messages.worker.HandshakeMessage(this.pubKey, envelope).toFrames());
      } else {
        logger.debug('on Handshake');
        e = envelope.toString('hex');
        try {
          d = this.rsaCrypto.Decrypt(message.data);
          desKey = d.toString().split(',');
          logger.debug(d.toString());
          if (desKey.length === 4) {
            tick = (new Date()).getTime();
            logger.debug(tick);
            sendTick = parseInt(desKey[3]);
            logger.debug(sendTick);
            if (Math.abs(tick - sendTick) / 100000000 < 3) {
              this.workers[e] = {
                k: new Buffer(desKey[0], 'base64'),
                i: new Buffer(desKey[1], 'base64'),
                s: new rsa(keySize, desKey[2]),
                isReady: true
              };
              logger.debug("Send ReadyMsg");
              return this.SendWithEncrypt(new messages.worker.ReadyMessage(envelope));
            } else {
              return logger.error('msg timeout:' + Math.abs(tick - sendTick) / 100000000);
            }
          }
        } catch (_error) {
          return logger.error('decrypt failed ' + message.data.toString());
        }
      }
    };

    Broker.prototype.onClientHandshake = function(message, envelope) {
      var d, desKey, e, sendTick, tick;
      logger.debug(message.data);
      if (!message.data) {
        logger.debug('send Handshake');
        return this.socket.send(new messages.client.HandshakeMessage(this.pubKey, envelope).toFrames());
      } else {
        logger.debug('on Handshake');
        e = envelope.toString('hex');
        logger.debug(message.data.toString());
        try {
          d = this.rsaCrypto.Decrypt(message.data);
          desKey = d.toString().split(',');
          if (desKey.length === 4) {
            tick = (new Date()).getTime();
            sendTick = parseInt(desKey[3]);
            if (Math.abs(tick - sendTick) / 100000000 < 1) {
              this.clients[e] = {
                k: new Buffer(desKey[0], 'base64'),
                i: new Buffer(desKey[1], 'base64'),
                s: new rsa(keySize, desKey[2]),
                isReady: true
              };
              return this.SendWithEncrypt(new messages.client.ReadyMessage('', envelope), envelope);
            } else {
              return logger.error('msg timeout');
            }
          }
        } catch (_error) {
          return logger.error('decrypt failed ' + message.data.toString());
        }
      }
    };

    Broker.prototype.SendWithEncrypt = function(msg) {
      var cipher, crypted, data, e, ex, hash;
      console.dir(msg);
      try {
        e = msg.envelope.toString('hex');
        if (this.workers[e] && this.workers[e].isReady) {
          cipher = crypto.createCipheriv('des3', this.workers[e].k, this.workers[e].i);
          crypted = cipher.update(JSON.stringify(msg), 'utf8', 'hex');
          crypted += cipher.final('hex');
          data = new Buffer(crypted, 'hex');
          hash = this.rsaCrypto.Sign(data);
          return this.socket.send([msg.envelope, data.toString('base64'), hash]);
        } else if (this.clients[e] && this.clients[e].isReady) {
          cipher = crypto.createCipheriv('des3', this.clients[e].k, this.clients[e].i);
          crypted = cipher.update(JSON.stringify(msg), 'utf8', 'hex');
          crypted += cipher.final('hex');
          data = new Buffer(crypted, 'hex');
          hash = this.rsaCrypto.Sign(data);
          return this.socket.send([msg.envelope, data.toString('base64'), hash]);
        }
      } catch (_error) {
        ex = _error;
        logger.error('Encrypt Failed');
        return logger.error(ex);
      }
    };

    Broker.prototype.disconnectWorker = function(envelope) {
      return this.socket.send(new messages.worker.DisconnectMessage(envelope).toFrames());
    };

    Broker.prototype.disconnect = function() {
      var keys;
      keys = Object.keys(this.services);
      if (!keys.length) {
        return;
      }
      return keys.forEach(function(service) {
        if (!this.services[service].workers) {
          return;
        }
        return this.services[service].waiting.forEach(function(worker) {
          return this.disconnectWorker(worker);
        }, this);
      }, this);
    };

    return Broker;

  })(EventEmitter);

  module.exports = {
    Broker: Broker
  };

}).call(this);
