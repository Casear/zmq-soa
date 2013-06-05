protocols = 
  client: 'MDPC02'
  worker: 'MDPW02'


types = 
  client: 
    REQUEST: 0x01
    RESPONSE: 0x02
  worker: 
    READY: 0x01
    REQUEST: 0x02
    HEARTBEAT: 0x03
    DISCONNECT: 0x04

class Message 
  constructor:(protocol, type, service, data, envelope)->
    @protocol = protocol;
    @type = type;
    @service = service;
    @data = data;
    @envelope = envelope;
  toFrames :()->
    frames = []
    if @envelope
      frames.push(@envelope)
    frames.push(@protocol)
    frames.push(@type)
    if @service
      frames.push(@service)
    if @data
      frames.push('')
      if Array.isArray(@data)
        frames = frames.concat(@data)
      else
        frames.push(@data)
    frames;
 
class ClientMessage extends Message
  constructor:(type, service, data, envelope)->
class WorkerMessage extends Message
  constructor:(type, service, data, envelope)->

class ClientRequestMessage extends ClientMessage
  constructor:(service, data, envelope)->
    super('request',service,data,envelope)
class ClientResponseMessage extends ClientMessage
  constructor:(service, data, envelope)->
    super('request',service,data,envelope)

class WorkerReadyMessage extends WorkerMessage
  constructor:(service, envelope)->
    super('ready',service,null,envelope)

class WorkerRequestMessage extends WorkerMessage
  constructor:(client, data, envelope)->
    super('request',client,data,envelope)

class WorkerHeartbeatMessage extends WorkerMessage 
  constructor:(envelope)->
    super('heartbeat',null,null,envelope)
class WorkerDisconnectMessage extends WorkerMessage 
  constructor:(envelope)->
    super('disconnect',null,null,envelope)

fromFrames = (frames, hasEnvelope)->
  frames = Array.prototype.slice.call(frames)
  protocol = frames[0]
  type = frames[1]
  service = frames[2]
  data = frames.slice(4)
  if hasEnvelope
    protocol = frames[1]
    type = frames[2]
    service = frames[3]
    data = frames.slice(5)
    envelope = frames[0]
  if protocol is protocols.client
    if type == types.client.REQUEST
      return new ClientRequestMessage(service, data, envelope)
    else if type is types.client.RESPONSE
      return new ClientResponseMessage(service, data, envelope)
  else if protocol is protocols.worker
    if type is types.worker.READY
      return new WorkerReadyMessage(service, envelope)
    else if type is types.worker.REQUEST
      return new WorkerRequestMessage(service, data)
    else if type == types.worker.HEARTBEAT
      return new WorkerHeartbeatMessage(envelope)
    else if type == types.worker.DISCONNECT
      return new WorkerDisconnectMessage(envelope)
    
module.exports = 
  fromFrames: fromFrames
  client: 
    Message: ClientMessage,
    RequestMessage: ClientRequestMessage
    ResponseMessage: ClientResponseMessage
  worker:
    Message: WorkerMessage,
    ReadyMessage: WorkerReadyMessage,
    RequestMessage: WorkerRequestMessage,
    HeartbeatMessage: WorkerHeartbeatMessage,
    DisconnectMessage: WorkerDisconnectMessage
