(function() {
  var ClientMessage, ClientRequestMessage, ClientResponseMessage, Message, WorkerDisconnectMessage, WorkerHeartbeatMessage, WorkerMessage, WorkerReadyMessage, WorkerRequestMessage, fromFrames, protocols, types,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  protocols = {
    client: 'MDPC02',
    worker: 'MDPW02'
  };

  types = {
    client: {
      REQUEST: 0x01,
      RESPONSE: 0x02
    },
    worker: {
      READY: 0x01,
      REQUEST: 0x02,
      HEARTBEAT: 0x03,
      DISCONNECT: 0x04
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
      frames.push(this.type);
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

    function ClientMessage(type, service, data, envelope) {}

    return ClientMessage;

  })(Message);

  WorkerMessage = (function(_super) {
    __extends(WorkerMessage, _super);

    function WorkerMessage(type, service, data, envelope) {}

    return WorkerMessage;

  })(Message);

  ClientRequestMessage = (function(_super) {
    __extends(ClientRequestMessage, _super);

    function ClientRequestMessage(service, data, envelope) {
      ClientRequestMessage.__super__.constructor.call(this, 'request', service, data, envelope);
    }

    return ClientRequestMessage;

  })(ClientMessage);

  ClientResponseMessage = (function(_super) {
    __extends(ClientResponseMessage, _super);

    function ClientResponseMessage(service, data, envelope) {
      ClientResponseMessage.__super__.constructor.call(this, 'request', service, data, envelope);
    }

    return ClientResponseMessage;

  })(ClientMessage);

  WorkerReadyMessage = (function(_super) {
    __extends(WorkerReadyMessage, _super);

    function WorkerReadyMessage(service, envelope) {
      WorkerReadyMessage.__super__.constructor.call(this, 'ready', service, null, envelope);
    }

    return WorkerReadyMessage;

  })(WorkerMessage);

  WorkerRequestMessage = (function(_super) {
    __extends(WorkerRequestMessage, _super);

    function WorkerRequestMessage(client, data, envelope) {
      WorkerRequestMessage.__super__.constructor.call(this, 'request', client, data, envelope);
    }

    return WorkerRequestMessage;

  })(WorkerMessage);

  WorkerHeartbeatMessage = (function(_super) {
    __extends(WorkerHeartbeatMessage, _super);

    function WorkerHeartbeatMessage(envelope) {
      WorkerHeartbeatMessage.__super__.constructor.call(this, 'heartbeat', null, null, envelope);
    }

    return WorkerHeartbeatMessage;

  })(WorkerMessage);

  WorkerDisconnectMessage = (function(_super) {
    __extends(WorkerDisconnectMessage, _super);

    function WorkerDisconnectMessage(envelope) {
      WorkerDisconnectMessage.__super__.constructor.call(this, 'disconnect', null, null, envelope);
    }

    return WorkerDisconnectMessage;

  })(WorkerMessage);

  fromFrames = function(frames, hasEnvelope) {
    var data, envelope, protocol, service, type;
    frames = Array.prototype.slice.call(frames);
    protocol = frames[0];
    type = frames[1];
    service = frames[2];
    data = frames.slice(4);
    if (hasEnvelope) {
      protocol = frames[1];
      type = frames[2];
      service = frames[3];
      data = frames.slice(5);
      envelope = frames[0];
    }
    if (protocol === protocols.client) {
      if (type === types.client.REQUEST) {
        return new ClientRequestMessage(service, data, envelope);
      } else if (type === types.client.RESPONSE) {
        return new ClientResponseMessage(service, data, envelope);
      }
    } else if (protocol === protocols.worker) {
      if (type === types.worker.READY) {
        return new WorkerReadyMessage(service, envelope);
      } else if (type === types.worker.REQUEST) {
        return new WorkerRequestMessage(service, data);
      } else if (type === types.worker.HEARTBEAT) {
        return new WorkerHeartbeatMessage(envelope);
      } else if (type === types.worker.DISCONNECT) {
        return new WorkerDisconnectMessage(envelope);
      }
    }
  };

  module.exports = {
    fromFrames: fromFrames,
    client: {
      Message: ClientMessage,
      RequestMessage: ClientRequestMessage,
      ResponseMessage: ClientResponseMessage
    },
    worker: {
      Message: WorkerMessage,
      ReadyMessage: WorkerReadyMessage,
      RequestMessage: WorkerRequestMessage,
      HeartbeatMessage: WorkerHeartbeatMessage,
      DisconnectMessage: WorkerDisconnectMessage
    }
  };

}).call(this);
