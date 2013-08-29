(function() {
  var ClientHeartbeatMessage, ClientMessage, ClientReadyMessage, ClientRequestMessage, ClientRequestNoRMessage, ClientResponseMessage, Message, WorkerDisconnectMessage, WorkerHeartbeatMessage, WorkerMessage, WorkerReadyMessage, WorkerRequestMessage, WorkerResponseMessage, defaultTimeout, fromFrames, logger, protocols, types,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };



  logger = require('./logger').logger;

  protocols = {
    client: 'MDPC02',
    worker: 'MDPW02'
  };

  defaultTimeout = 5;

  types = {
    client: {
      READY: 0x01,
      REQUEST: 0x02,
      REQUEST_NR: 0x03,
      RESPONSE: 0x04,
      HEARTBEAT: 0x05
    },
    worker: {
      READY: 0x01,
      REQUEST: 0x02,
      RESPONSE: 0x03,
      HEARTBEAT: 0x04,
      DISCONNECT: 0x05
    }
  };

  Message = (function() {
    function Message(protocol, type, service, data, envelope, mapping, time) {
      this.protocol = protocol;
      this.type = type;
      this.service = service;
      this.data = data;
      this.envelope = envelope;
      this.mapping = mapping;
      this.time = time;
    }

    Message.prototype.toFrames = function() {
      var frames;
      frames = [];
      if (this.envelope) {
        frames.push(this.envelope);
      }
      frames.push(this.protocol);
      frames.push(new Buffer([this.type]));
      if (this.service) {
        frames.push(this.service);
      }
      if (this.mapping) {
        frames.push(this.mapping);
      } else {
        frames.push('');
      }
      if (this.time) {
        frames.push(new Buffer([this.time]));
      } else {
        frames.push(new Buffer([defaultTimeout]));
      }
      if (this.data) {
        frames.push('');
        if (Array.isArray(this.data)) {
          frames = frames.concat(this.data);
        } else {
          frames.push(this.data);
        }
      }
      return frames;
    };

    return Message;

  })();

  ClientMessage = (function(_super) {
    __extends(ClientMessage, _super);

    function ClientMessage(type, service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientMessage.__super__.constructor.call(this, protocols.client, type, service, data, envelope, mapping, time);
    }

    return ClientMessage;

  })(Message);

  WorkerMessage = (function(_super) {
    __extends(WorkerMessage, _super);

    function WorkerMessage(type, service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerMessage.__super__.constructor.call(this, protocols.worker, type, service, data, envelope, mapping, time);
    }

    return WorkerMessage;

  })(Message);

  ClientReadyMessage = (function(_super) {
    __extends(ClientReadyMessage, _super);

    function ClientReadyMessage(envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientReadyMessage.__super__.constructor.call(this, types.client.READY, null, null, envelope, time);
    }

    return ClientReadyMessage;

  })(ClientMessage);

  ClientRequestMessage = (function(_super) {
    __extends(ClientRequestMessage, _super);

    function ClientRequestMessage(service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientRequestMessage.__super__.constructor.call(this, types.client.REQUEST, service, data, envelope, mapping, time);
    }

    return ClientRequestMessage;

  })(ClientMessage);

  ClientRequestNoRMessage = (function(_super) {
    __extends(ClientRequestNoRMessage, _super);

    function ClientRequestNoRMessage(service, data, envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientRequestNoRMessage.__super__.constructor.call(this, types.client.REQUEST_NR, service, data, envelope, time);
    }

    return ClientRequestNoRMessage;

  })(ClientMessage);

  ClientResponseMessage = (function(_super) {
    __extends(ClientResponseMessage, _super);

    function ClientResponseMessage(service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientResponseMessage.__super__.constructor.call(this, types.client.RESPONSE, service, data, envelope, mapping, time);
    }

    return ClientResponseMessage;

  })(ClientMessage);

  ClientHeartbeatMessage = (function(_super) {
    __extends(ClientHeartbeatMessage, _super);

    function ClientHeartbeatMessage(envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientHeartbeatMessage.__super__.constructor.call(this, types.client.HEARTBEAT, null, null, envelope, time);
    }

    return ClientHeartbeatMessage;

  })(ClientMessage);

  WorkerReadyMessage = (function(_super) {
    __extends(WorkerReadyMessage, _super);

    function WorkerReadyMessage(service, data, envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerReadyMessage.__super__.constructor.call(this, types.worker.READY, service, data, envelope, null, time);
    }

    return WorkerReadyMessage;

  })(WorkerMessage);

  WorkerRequestMessage = (function(_super) {
    __extends(WorkerRequestMessage, _super);

    function WorkerRequestMessage(service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerRequestMessage.__super__.constructor.call(this, types.worker.REQUEST, service, data, envelope, mapping, time);
    }

    return WorkerRequestMessage;

  })(WorkerMessage);

  WorkerResponseMessage = (function(_super) {
    __extends(WorkerResponseMessage, _super);

    function WorkerResponseMessage(service, data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerResponseMessage.__super__.constructor.call(this, types.worker.RESPONSE, service, data, envelope, mapping, time);
    }

    return WorkerResponseMessage;

  })(WorkerMessage);

  WorkerHeartbeatMessage = (function(_super) {
    __extends(WorkerHeartbeatMessage, _super);

    function WorkerHeartbeatMessage(envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerHeartbeatMessage.__super__.constructor.call(this, types.worker.HEARTBEAT, null, null, envelope, null, time);
    }

    return WorkerHeartbeatMessage;

  })(WorkerMessage);

  WorkerDisconnectMessage = (function(_super) {
    __extends(WorkerDisconnectMessage, _super);

    function WorkerDisconnectMessage(envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerDisconnectMessage.__super__.constructor.call(this, types.worker.DISCONNECT, null, null, envelope, null, time);
    }

    return WorkerDisconnectMessage;

  })(WorkerMessage);

  fromFrames = function(frames, hasEnvelope) {
    var data, envelope, ex, mapping, protocol, service, time, type;
    try {
      frames = Array.prototype.slice.call(frames);
      if (frames.length < 2) {
        null;
      } else {
        if (hasEnvelope) {
          envelope = frames[0];
          protocol = frames[1].toString('ascii');
          type = frames[2].readInt8(0);
          service = frames[3];
          mapping = frames[4];
          try {
            time = frames[5].readInt8(0);
          } catch (_error) {
            time = 5;
          }
          data = frames[7];
        } else {
          protocol = frames[0].toString('ascii');
          type = frames[1].readInt8(0);
          service = frames[2];
          mapping = frames[3];
          try {
            time = frames[4].readInt8(0);
          } catch (_error) {
            time = 5;
          }
          data = frames[6];
        }
        logger.debug(protocol);
        if (protocol === protocols.client) {
          logger.debug('types.client');
          if (type === types.client.REQUEST) {
            logger.debug('types.client.REQUEST');
            return new ClientRequestMessage(service, data, envelope, mapping, time);
          } else if (type === types.client.READY) {
            logger.debug('types.client.READY');
            return new ClientReadyMessage(service, data, envelope, time);
          }
          if (type === types.client.REQUEST_NR) {
            logger.debug('types.client.REQUEST_NR');
            return new ClientRequestNoRMessage(service, data, envelope, time);
          } else if (type === types.client.RESPONSE) {
            logger.debug('types.client.RESPONSE');
            return new ClientResponseMessage(service, data, envelope, mapping, time);
          } else if (type === types.client.HEARTBEAT) {
            logger.debug('types.client.HEARTBEAT');
            return new ClientHeartbeatMessage(envelope, time);
          }
        } else if (protocol === protocols.worker) {
          logger.debug('types.woker');
          if (type === types.worker.READY) {
            logger.debug('types.worker.READY');
            return new WorkerReadyMessage(service, data, envelope, time);
          } else if (type === types.worker.REQUEST) {
            logger.debug('types.worker.REQUEST');
            return new WorkerRequestMessage(service, data, envelope, mapping, time);
          } else if (type === types.worker.RESPONSE) {
            logger.debug('types.worker.RESPONSE');
            return new WorkerResponseMessage(service, data, envelope, mapping, time);
          } else if (type === types.worker.HEARTBEAT) {
            logger.debug('types.worker.HEARTBEAT');
            return new WorkerHeartbeatMessage(envelope, time);
          } else if (type === types.worker.DISCONNECT) {
            logger.debug('types.worker.DISCONNECT');
            return new WorkerDisconnectMessage(envelope, time);
          }
        }
      }
    } catch (_error) {
      ex = _error;
      logger.error('Message格式有誤');
      logger.error(ex);
      null;
    }
    logger.error('Message格式有誤');
    logger.error(frames);
    return logger.error({
      protocol: protocol,
      type: type,
      service: service,
      mapping: mapping,
      time: time,
      data: data
    });
  };

  module.exports = {
    fromFrames: fromFrames,
    client: {
      Message: ClientMessage,
      ReadyMessage: ClientReadyMessage,
      RequestMessage: ClientRequestMessage,
      RequestNoRMessage: ClientRequestNoRMessage,
      ResponseMessage: ClientResponseMessage,
      HeartbeatMessage: ClientHeartbeatMessage
    },
    worker: {
      Message: WorkerMessage,
      ReadyMessage: WorkerReadyMessage,
      RequestMessage: WorkerRequestMessage,
      ResponseMessage: WorkerResponseMessage,
      HeartbeatMessage: WorkerHeartbeatMessage,
      DisconnectMessage: WorkerDisconnectMessage
    }
  };

}).call(this);
