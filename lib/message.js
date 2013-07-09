(function() {
  var ClientHeartbeatMessage, ClientMessage, ClientReadyMessage, ClientRequestMessage, ClientRequestNoRMessage, ClientResponseMessage, Message, WorkerDisconnectMessage, WorkerHeartbeatMessage, WorkerMessage, WorkerReadyMessage, WorkerRequestMessage, WorkerResponseMessage, fromFrames, logger, protocols, types,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  logger = require('./logger').logger;

  protocols = {
    client: 'MDPC02',
    worker: 'MDPW02'
  };

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
    function Message(protocol, type, service, data, envelope) {
      this.protocol = protocol;
      this.type = type;
      this.service = service;
      this.data = data;
      this.envelope = envelope;
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

    function ClientMessage(type, service, data, envelope) {
      ClientMessage.__super__.constructor.call(this, protocols.client, type, service, data, envelope);
    }

    return ClientMessage;

  })(Message);

  WorkerMessage = (function(_super) {
    __extends(WorkerMessage, _super);

    function WorkerMessage(type, service, data, envelope) {
      WorkerMessage.__super__.constructor.call(this, protocols.worker, type, service, data, envelope);
    }

    return WorkerMessage;

  })(Message);

  ClientReadyMessage = (function(_super) {
    __extends(ClientReadyMessage, _super);

    function ClientReadyMessage(envelope) {
      ClientReadyMessage.__super__.constructor.call(this, types.client.READY, null, null, envelope);
    }

    return ClientReadyMessage;

  })(ClientMessage);

  ClientRequestMessage = (function(_super) {
    __extends(ClientRequestMessage, _super);

    function ClientRequestMessage(service, data, envelope) {
      ClientRequestMessage.__super__.constructor.call(this, types.client.REQUEST, service, data, envelope);
    }

    return ClientRequestMessage;

  })(ClientMessage);

  ClientRequestNoRMessage = (function(_super) {
    __extends(ClientRequestNoRMessage, _super);

    function ClientRequestNoRMessage(service, data, envelope) {
      ClientRequestNoRMessage.__super__.constructor.call(this, types.client.REQUEST_NR, service, data, envelope);
    }

    return ClientRequestNoRMessage;

  })(ClientMessage);

  ClientResponseMessage = (function(_super) {
    __extends(ClientResponseMessage, _super);

    function ClientResponseMessage(service, data, envelope) {
      ClientResponseMessage.__super__.constructor.call(this, types.client.RESPONSE, service, data, envelope);
    }

    return ClientResponseMessage;

  })(ClientMessage);

  ClientHeartbeatMessage = (function(_super) {
    __extends(ClientHeartbeatMessage, _super);

    function ClientHeartbeatMessage(envelope) {
      ClientHeartbeatMessage.__super__.constructor.call(this, types.client.HEARTBEAT, null, null, envelope);
    }

    return ClientHeartbeatMessage;

  })(ClientMessage);

  WorkerReadyMessage = (function(_super) {
    __extends(WorkerReadyMessage, _super);

    function WorkerReadyMessage(service, data, envelope) {
      WorkerReadyMessage.__super__.constructor.call(this, types.worker.READY, service, data, envelope);
    }

    return WorkerReadyMessage;

  })(WorkerMessage);

  WorkerRequestMessage = (function(_super) {
    __extends(WorkerRequestMessage, _super);

    function WorkerRequestMessage(service, data, envelope) {
      WorkerRequestMessage.__super__.constructor.call(this, types.worker.REQUEST, service, data, envelope);
    }

    return WorkerRequestMessage;

  })(WorkerMessage);

  WorkerResponseMessage = (function(_super) {
    __extends(WorkerResponseMessage, _super);

    function WorkerResponseMessage(service, data, envelope) {
      WorkerResponseMessage.__super__.constructor.call(this, types.worker.RESPONSE, service, data, envelope);
    }

    return WorkerResponseMessage;

  })(WorkerMessage);

  WorkerHeartbeatMessage = (function(_super) {
    __extends(WorkerHeartbeatMessage, _super);

    function WorkerHeartbeatMessage(envelope) {
      WorkerHeartbeatMessage.__super__.constructor.call(this, types.worker.HEARTBEAT, null, null, envelope);
    }

    return WorkerHeartbeatMessage;

  })(WorkerMessage);

  WorkerDisconnectMessage = (function(_super) {
    __extends(WorkerDisconnectMessage, _super);

    function WorkerDisconnectMessage(envelope) {
      WorkerDisconnectMessage.__super__.constructor.call(this, types.worker.DISCONNECT, null, null, envelope);
    }

    return WorkerDisconnectMessage;

  })(WorkerMessage);

  fromFrames = function(frames, hasEnvelope) {
    var data, envelope, protocol, service, type;
    frames = Array.prototype.slice.call(frames);
    if (frames.length < 2) {
      return null;
    } else {
      if (hasEnvelope) {
        envelope = frames[0];
        protocol = frames[1].toString('ascii');
        type = frames[2].readInt8(0);
        service = frames[3];
        data = frames[5];
      } else {
        protocol = frames[0].toString('ascii');
        type = frames[1].readInt8(0);
        service = frames[2];
        data = frames[4];
      }
      if (protocol === protocols.client) {
        if (type === types.client.REQUEST) {
          logger.debug('types.client.REQUEST');
          return new ClientRequestMessage(service, data, envelope);
        } else if (type === types.client.READY) {
          logger.debug('types.client.READY');
          return new ClientReadyMessage(service, data, envelope);
        }
        if (type === types.client.REQUEST_NR) {
          logger.debug('types.client.REQUEST_NR');
          return new ClientRequestNoRMessage(service, data, envelope);
        } else if (type === types.client.RESPONSE) {
          logger.debug('types.client.RESPONSE');
          return new ClientResponseMessage(service, data, envelope);
        } else if (type === types.client.HEARTBEAT) {
          logger.debug('types.client.HEARTBEAT');
          return new ClientHeartbeatMessage(envelope);
        }
      } else if (protocol === protocols.worker) {
        if (type === types.worker.READY) {
          logger.debug('types.worker.READY');
          return new WorkerReadyMessage(service, data, envelope);
        } else if (type === types.worker.REQUEST) {
          logger.debug('types.worker.REQUEST');
          return new WorkerRequestMessage(service, data);
        } else if (type === types.worker.RESPONSE) {
          logger.debug('types.worker.RESPONSE');
          return new WorkerResponseMessage(service, data);
        } else if (type === types.worker.HEARTBEAT) {
          logger.debug('types.worker.HEARTBEAT');
          return new WorkerHeartbeatMessage(envelope);
        } else if (type === types.worker.DISCONNECT) {
          logger.debug('types.worker.DISCONNECT');
          return new WorkerDisconnectMessage(envelope);
        }
      }
    }
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
