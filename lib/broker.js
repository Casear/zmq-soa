(function() {
  var Broker, EventEmitter, logger, messages, redis, zmq, _,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };



  redis = require('redis');

  zmq = require('zmq');

  messages = require('./message');

  logger = (require('./logger')).logger;

  EventEmitter = require('events').EventEmitter;

  _ = require('underscore');

  Broker = (function(_super) {
    __extends(Broker, _super);

    function Broker(endpoint, options) {
      this.services = {};
      this.workers = {};
      this.clients = {};
      this.queue = [];
      this.mapping = {};
      this.socket = zmq.socket('router');
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
        logger.debug(message);
        logger.debug('executeQueue length:' + this.queue.length);
        service = message.service.toString();
        logger.debug('request ' + service);
        if (this.services[service].worker > 0) {
          worker = this.services[service].waiting.shift();
          worklabel = worker;
          this.services[service].worker--;
          if (message instanceof messages.client.RequestMessage) {
            if (this.mapping[worklabel]) {
              logger.error('envelope exist');
            }
            this.mapping[worklabel] = message;
          }
          r = new messages.worker.RequestMessage(service, message.data, new Buffer(worker, 'hex')).toFrames();
          this.socket.send(r);
        } else {
          if (this.services[service]) {
            this.queue.push(message);
          }
        }
      }
      return setImmediate(this.executeQueue.bind(this));
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
      logger.info('client connect');
      if (!this.clients[envelope]) {
        this.clients[envelope] = {};
        return this.clients[envelope].checkHeartbeat = setTimeout((function() {
          if (this.clients[envelope]) {
            return delete this.clients[envelope];
          }
        }).bind(this), 15000);
      }
    };

    Broker.prototype.onClientHeartBeat = function(envelope) {
      logger.debug('client  heartbeat');
      if (this.clients[envelope]) {
        clearTimeout(this.clients[envelope].checkHeartbeat);
        this.clients[envelope].checkHeartbeat = setTimeout((function() {
          return delete this.clients[envelope];
        }).bind(this), 15000);
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
            index = _.indexOf(this.services[this.workers[e].service].waiting, envelope.toString('hex'));
            if (index !== -1) {
              this.services[this.workers[e].service].waiting.splice(index, 1);
              this.services[this.workers[e].service].worker--;
              return delete this.workers[e];
            }
          }
        }).bind(this), 15000);
        return this.socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames());
      } else {
        return this.socket.send(new messages.worker.ReadyMessage(null, null, envelope).toFrames());
      }
    };

    Broker.prototype.onClientRequest = function(message) {
      if (this.services.hasOwnProperty(message.service.toString())) {
        return this.queue.push(message);
      }
    };

    Broker.prototype.onWorkerResponse = function(message, envelope) {
      var clientEnvelope, mapEnvelope, workerlabel;
      logger.debug('onWorkerResponse');
      logger.debug(this.mapping);
      workerlabel = envelope.toString('hex');
      if (this.mapping[workerlabel]) {
        clientEnvelope = this.mapping[workerlabel].envelope;
        mapEnvelope = this.mapping[workerlabel].mapping;
        delete this.mapping[workerlabel];
        this.socket.send(new messages.client.ResponseMessage(message.service, message.data, clientEnvelope, mapEnvelope).toFrames());
      } else {
        logger.debug('onWorkerResponse without response');
      }
      this.services[message.service.toString()].waiting.push(workerlabel);
      return this.services[message.service.toString()].worker++;
    };

    Broker.prototype.onWorkerReady = function(message, envelope) {
      var e, service;
      console.dir(message);
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
      this.services[service].worker++;
      this.services[service].waiting.push(e);
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
      }).bind(this), 15000);
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
