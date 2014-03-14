(function() {
  var ClientAuthMessage, ClientBServiceMessage, ClientHandshakeMessage, ClientHeartbeatMessage, ClientMessage, ClientReadyMessage, ClientRequestMessage, ClientResponseMessage, ClientTimeoutMessage, Message, WorkerAuthMessage, WorkerBServiceMessage, WorkerDisconnectMessage, WorkerHandshakeMessage, WorkerHeartbeatMessage, WorkerMessage, WorkerReadyMessage, WorkerRequestMessage, WorkerResponseMessage, defaultTimeout, fromFrames, fromJSON, logger, protocols, types,
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
      RESPONSE: 0x03,
      HEARTBEAT: 0x04,
      DISCONNECT: 0x05,
      Handshake: 0x06,
      AUTH: 0x07,
      BSERVICE: 0x08,
      TIMEOUT: 0x09
    },
    worker: {
      READY: 0x01,
      REQUEST: 0x02,
      RESPONSE: 0x03,
      HEARTBEAT: 0x04,
      DISCONNECT: 0x05,
      Handshake: 0x06,
      AUTH: 0x07,
      BSERVICE: 0x08,
      TIMEOUT: 0x09
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
      } else {
        frames.push('');
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

  ClientBServiceMessage = (function(_super) {
    __extends(ClientBServiceMessage, _super);

    function ClientBServiceMessage(data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      ClientBServiceMessage.__super__.constructor.call(this, types.client.BSERVICE, null, data, envelope, mapping, time);
    }

    return ClientBServiceMessage;

  })(ClientMessage);

  ClientReadyMessage = (function(_super) {
    __extends(ClientReadyMessage, _super);

    function ClientReadyMessage(envelope) {
      var time;
      if (!time) {
        time = defaultTimeout;
      }
      ClientReadyMessage.__super__.constructor.call(this, types.client.READY, null, null, envelope);
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

    function ClientHeartbeatMessage(envelope) {
      var time;
      if (!time) {
        time = defaultTimeout;
      }
      ClientHeartbeatMessage.__super__.constructor.call(this, types.client.HEARTBEAT, null, null, envelope);
    }

    return ClientHeartbeatMessage;

  })(ClientMessage);

  ClientAuthMessage = (function(_super) {
    __extends(ClientAuthMessage, _super);

    function ClientAuthMessage(data, envelope) {
      var time;
      if (!time) {
        time = defaultTimeout;
      }
      ClientAuthMessage.__super__.constructor.call(this, types.client.AUTH, null, data, envelope);
    }

    return ClientAuthMessage;

  })(ClientMessage);

  ClientHandshakeMessage = (function(_super) {
    __extends(ClientHandshakeMessage, _super);

    function ClientHandshakeMessage(data, envelope) {
      var time;
      if (!time) {
        time = defaultTimeout;
      }
      ClientHandshakeMessage.__super__.constructor.call(this, types.client.Handshake, null, data, envelope);
    }

    return ClientHandshakeMessage;

  })(ClientMessage);

  ClientTimeoutMessage = (function(_super) {
    __extends(ClientTimeoutMessage, _super);

    function ClientTimeoutMessage(envelope, mapping) {
      var time;
      if (!time) {
        time = defaultTimeout;
      }
      ClientTimeoutMessage.__super__.constructor.call(this, types.worker.TIMEOUT, null, null, envelope, mapping, time);
    }

    return ClientTimeoutMessage;

  })(ClientMessage);

  WorkerBServiceMessage = (function(_super) {
    __extends(WorkerBServiceMessage, _super);

    function WorkerBServiceMessage(data, envelope, mapping, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerBServiceMessage.__super__.constructor.call(this, types.worker.BSERVICE, null, data, envelope, mapping, time);
    }

    return WorkerBServiceMessage;

  })(WorkerMessage);

  WorkerReadyMessage = (function(_super) {
    __extends(WorkerReadyMessage, _super);

    function WorkerReadyMessage(envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerReadyMessage.__super__.constructor.call(this, types.worker.READY, null, null, envelope, null, time);
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

  WorkerAuthMessage = (function(_super) {
    __extends(WorkerAuthMessage, _super);

    function WorkerAuthMessage(data, envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerAuthMessage.__super__.constructor.call(this, types.worker.AUTH, null, data, envelope, null, time);
    }

    return WorkerAuthMessage;

  })(WorkerMessage);

  WorkerHandshakeMessage = (function(_super) {
    __extends(WorkerHandshakeMessage, _super);

    function WorkerHandshakeMessage(data, envelope, time) {
      if (!time) {
        time = defaultTimeout;
      }
      WorkerHandshakeMessage.__super__.constructor.call(this, types.worker.Handshake, null, data, envelope, null, time);
    }

    return WorkerHandshakeMessage;

  })(WorkerMessage);

  fromJSON = function(frames, elp) {
    var data, envelope, mapping, protocol, service, time, type;
    if (frames.Envelope) {
      envelope = frames.Envelope;
    } else if (frames.envelope) {
      envelope = frames.envelope;
    } else {
      envelope = elp;
    }
    if (frames.Protocol === 0 || frames.Protocol === 'MDPW02') {
      protocol = 'MDPW02';
    } else if (frames.protocol === 'MDPW02') {
      protocol = frames.protocol;
    } else {
      protocol = 'MDPC02';
    }
    if (frames.SendType) {
      type = frames.SendType;
    } else if (frames.type) {
      type = frames.type;
    }
    if (frames.Service) {
      service = frames.Service;
    } else if (frames.service) {
      service = frames.service;
    }
    if (frames.Mapping) {
      if (Buffer.isBuffer(frames.Mapping)) {
        mapping = frames.Mapping;
      } else {
        mapping = new Buffer(frames.Mapping);
      }
    } else if (frames.mapping) {
      if (Buffer.isBuffer(frames.mapping)) {
        mapping = frames.mapping;
      } else {
        mapping = new Buffer(frames.mapping);
      }
    }
    if (frames.Time) {
      time = frames.Time;
    } else if (frames.time) {
      time = frames.time;
    } else {
      time = 5;
    }
    if (frames.Data) {
      data = new Buffer(frames.Data, 'base64');
    } else if (frames.data) {
      data = new Buffer(frames.data, 'base64');
    }
    if (protocol === protocols.client) {
      logger.debug('types.client');
      if (type === types.client.REQUEST) {
        logger.debug('types.client.REQUEST');
        return new ClientRequestMessage(service, data, envelope, mapping, time);
      } else if (type === types.client.READY) {
        logger.debug('types.client.READY');
        return new ClientReadyMessage(service, data, envelope, time);
      } else if (type === types.client.BSERVICE) {
        logger.debug('types.client.BService');
        return new ClientBServiceMessage(data, envelope, mapping, time);
      } else if (type === types.client.RESPONSE) {
        logger.debug('types.client.RESPONSE');
        return new ClientResponseMessage(service, data, envelope, mapping, time);
      } else if (type === types.client.TIMEOUT) {
        logger.debug('types.client.HEARTBEAT');
        return new ClientTimeoutMessage(envelope, mapping);
      } else if (type === types.client.HEARTBEAT) {
        logger.debug('types.client.HEARTBEAT');
        return new ClientHeartbeatMessage(envelope, time);
      } else if (type === types.client.AUTH) {
        logger.debug('types.client.AUTH');
        return new ClientAuthMessage(data, envelope, time);
      } else if (type === types.client.Handshake) {
        logger.debug('types.client.Handshake');
        return new ClientHandshakeMessage(data, envelope, time);
      }
    } else if (protocol === protocols.worker) {
      logger.debug('types.woker');
      if (type === types.worker.READY) {
        logger.debug('types.worker.READY');
        return new WorkerReadyMessage(envelope, time);
      } else if (type === types.worker.REQUEST) {
        logger.debug('types.worker.REQUEST');
        return new WorkerRequestMessage(service, data, envelope, mapping, time);
      }
      if (type === types.worker.BSERVICE) {
        logger.debug('types.worker.BSERVICE');
        return new WorkerBServiceMessage(data, envelope, mapping, time);
      } else if (type === types.worker.RESPONSE) {
        logger.debug('types.worker.RESPONSE');
        return new WorkerResponseMessage(service, data, envelope, mapping, time);
      } else if (type === types.worker.HEARTBEAT) {
        logger.debug('types.worker.HEARTBEAT');
        return new WorkerHeartbeatMessage(envelope, time);
      } else if (type === types.worker.DISCONNECT) {
        logger.debug('types.worker.DISCONNECT');
        return new WorkerDisconnectMessage(envelope, time);
      } else if (type === types.worker.AUTH) {
        logger.debug('types.worker.AUTH');
        return new WorkerAuthMessage(data, envelope, time);
      } else if (type === types.worker.Handshake) {
        logger.debug('types.worker.Handshake');
        return new WorkerHandshakeMessage(data, envelope, time);
      }
    }
  };

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
          } else if (type === types.client.BSERVICE) {
            logger.debug('types.client.BService');
            return new ClientBServiceMessage(data, envelope, mapping, time);
          } else if (type === types.client.RESPONSE) {
            logger.debug('types.client.RESPONSE');
            return new ClientResponseMessage(service, data, envelope, mapping, time);
          } else if (type === types.client.HEARTBEAT) {
            logger.debug('types.client.HEARTBEAT');
            return new ClientHeartbeatMessage(envelope, time);
          } else if (type === types.client.AUTH) {
            logger.debug('types.client.AUTH');
            return new ClientAuthMessage(data, envelope, time);
          } else if (type === types.client.Handshake) {
            logger.debug('types.client.Handshake');
            return new ClientHandshakeMessage(data, envelope, time);
          }
        } else if (protocol === protocols.worker) {
          logger.debug('types.woker');
          if (type === types.worker.READY) {
            logger.debug('types.worker.READY');
            return new WorkerReadyMessage(envelope, time);
          }
          if (type === types.worker.BSERVICE) {
            logger.debug('types.worker.BSERVICE');
            return new WorkerBServiceMessage(data, envelope, mapping, time);
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
          } else if (type === types.worker.AUTH) {
            logger.debug('types.worker.AUTH');
            return new WorkerAuthMessage(data, envelope, time);
          } else if (type === types.worker.Handshake) {
            logger.debug('types.worker.Handshake');
            return new WorkerHandshakeMessage(data, envelope, time);
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
    fromJSON: fromJSON,
    client: {
      Message: ClientMessage,
      ReadyMessage: ClientReadyMessage,
      RequestMessage: ClientRequestMessage,
      ResponseMessage: ClientResponseMessage,
      HeartbeatMessage: ClientHeartbeatMessage,
      AuthMessage: ClientAuthMessage,
      HandshakeMessage: ClientHandshakeMessage,
      BServiceMessage: ClientBServiceMessage,
      TimeoutMessage: ClientTimeoutMessage
    },
    worker: {
      Message: WorkerMessage,
      ReadyMessage: WorkerReadyMessage,
      RequestMessage: WorkerRequestMessage,
      ResponseMessage: WorkerResponseMessage,
      HeartbeatMessage: WorkerHeartbeatMessage,
      DisconnectMessage: WorkerDisconnectMessage,
      AuthMessage: WorkerAuthMessage,
      HandshakeMessage: WorkerHandshakeMessage,
      BServiceMessage: WorkerBServiceMessage
    }
  };

}).call(this);
