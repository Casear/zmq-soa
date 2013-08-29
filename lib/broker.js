(function() {
  var Broker, EventEmitter, heartbeatTime, logger, messages, redis, zmq, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };



  redis = require('redis');

  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  EventEmitter = require('events').EventEmitter;

  _ = require('underscore');

  heartbeatTime = 20000;

  Broker = (function(_super) {
    __extends(Broker, _super);

    function Broker(endpoint, options, log) {
      this.services = {};
      this.workers = {};
      this.clients = {};
      this.queue = [];
      this.mapping = {};
      this.socket = zmq.socket('router');
      if (log) {
        logger = log;
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

    Broker.prototype.onMessage = function(envelope, protocol, type) {
      var message;
      logger.debug('broker on Message');
      logger.debug(arguments);
      message = messages.fromFrames(arguments, true);
      if (message instanceof messages.client.Message) {
        if (message instanceof messages.client.RequestMessage || message instanceof messages.client.RequestNoRMessage) {
          logger.debug('broker: on client Request');
          this.onClientRequest(message);
        }
        if (message instanceof messages.client.ReadyMessage) {
          logger.debug('broker: on client Ready');
          this.onClientReady(envelope);
        }
        if (message instanceof messages.client.HeartbeatMessage) {
          logger.debug('broker: on client Heartbeat');
          return this.onClientHeartBeat(envelope);
        }
      } else if (message instanceof messages.worker.Message) {
        if (message instanceof messages.worker.ReadyMessage) {
          logger.debug('broker: on worker Ready');
          this.onWorkerReady(message, envelope);
        }
        if (message instanceof messages.worker.HeartbeatMessage) {
          logger.debug('broker: on worker heartbeat');
          this.onWorkerHeartBeat(message, envelope);
        }
        if (message instanceof messages.worker.ResponseMessage) {
          logger.debug('broker: on worker Response');
          return this.onWorkerResponse(message, envelope);
        } else if (message instanceof messages.worker.DisconnectMessage) {
          logger.debug('broker: on worker Disconnect');
          return this.onWorkerDisconnect(message);
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
          var index, _results;
          if (this.workers[e]) {
            index = _.indexOf(this.services[this.workers[e].service].waiting, e);
            _results = [];
            while (index !== -1) {
              this.services[this.workers[e].service].waiting.splice(index, 1);
              this.services[this.workers[e].service].worker--;
              index = _.indexOf(this.services[this.workers[e].service].waiting, e);
              if (this.workers[e]) {
                _results.push(delete this.workers[e]);
              } else {
                _results.push(void 0);
              }
            }
            return _results;
          }
        }).bind(this), heartbeatTime);
        return this.socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames());
      } else {
        return this.socket.send(new messages.worker.ReadyMessage(null, null, envelope).toFrames());
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

    Broker.prototype.onWorkerReady = function(message, envelope) {
      var e, service;
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
        this.workers[e] = JSON.parse(message.data.toString());
      } else {
        this.workers[e] = {};
      }
      this.workers[e].service = service;
      if (_.indexOf(this.services[service].waiting, e) === -1) {
        this.services[service].worker++;
        this.services[service].waiting.push(e);
      }
      logger.debug(this.services);
      return this.workers[e].checkHeartbeat = setTimeout((function() {
        var index;
        if (this.workers[e]) {
          index = _.indexOf(this.services[this.workers[e].service].waiting, e);
          if (index !== -1) {
            this.services[this.workers[e].service].waiting.splice(index, 1);
            this.services[this.workers[e].service].worker--;
            return delete this.workers[e];
          }
        }
      }).bind(this), heartbeatTime);
    };

    Broker.prototype.onWorkerDisconnect = function(message) {};

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

    Broker.prototype.findServiceBySender = function(sender) {
      var knownService;
      knownService = '';
      Object.keys(this.services).forEach(function(service) {
        if (this.services[service].waiting.some(function(worker) {
          return sender.toString() === worker.toString();
        })) {
          return knownService = service;
        }
      }, this);
      return knownService;
    };

    Broker.prototype.findIndexBySenderService = function(sender, service) {
      var knownIndex;
      knownIndex = -1;
      this.services[service].waiting.forEach(function(worker, index) {
        if (worker.toString() === sender.toString()) {
          return knownIndex = index;
        }
      });
      return knownIndex;
    };

    return Broker;

  })(EventEmitter);

  module.exports = {
    Broker: Broker
  };

}).call(this);
