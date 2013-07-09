logger = require('./logger').logger
protocols = 
  client: 'MDPC02'
  worker: 'MDPW02'


types = 
  client: 
    READY:0x01
    REQUEST: 0x02
    REQUEST_NR: 0x03
    RESPONSE: 0x04
    HEARTBEAT: 0x05
  worker: 
    READY: 0x01
    REQUEST: 0x02
    RESPONSE: 0x03
    HEARTBEAT: 0x04
    DISCONNECT: 0x05

class Message 
  constructor:(@protocol, @type, @service, @data, @envelope)->
  toFrames :()->
    frames = []
    if @envelope
      frames.push(@envelope)
    frames.push(@protocol)
    frames.push(new Buffer([@type]))
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
    super(protocols.client,type, service, data, envelope)
class WorkerMessage extends Message
  constructor:(type, service, data, envelope)->
    super(protocols.worker,type, service, data, envelope)

class ClientReadyMessage extends ClientMessage
  constructor:(envelope)->
    super(types.client.READY,null,null,envelope)
class ClientRequestMessage extends ClientMessage
  constructor:(service, data, envelope)->
    super(types.client.REQUEST,service,data,envelope)
class ClientRequestNoRMessage extends ClientMessage
  constructor:(service, data, envelope)->
    super(types.client.REQUEST_NR,service,data,envelope)
class ClientResponseMessage extends ClientMessage
  constructor:(service, data, envelope)->
    super(types.client.RESPONSE,service,data,envelope)
class ClientHeartbeatMessage extends ClientMessage
  constructor:(envelope)->
    super(types.client.HEARTBEAT,null,null,envelope)


    
class WorkerReadyMessage extends WorkerMessage
  constructor:(service, data,envelope)->
    super(types.worker.READY,service,data,envelope)

class WorkerRequestMessage extends WorkerMessage
  constructor:(service, data, envelope)->
    super(types.worker.REQUEST,service,data,envelope)

class WorkerResponseMessage extends WorkerMessage
  constructor:(service, data, envelope)->
    super(types.worker.RESPONSE,service,data,envelope)

class WorkerHeartbeatMessage extends WorkerMessage 
  constructor:(envelope)->
    super(types.worker.HEARTBEAT,null,null,envelope)
class WorkerDisconnectMessage extends WorkerMessage 
  constructor:(envelope)->
    super(types.worker.DISCONNECT,null,null,envelope)

fromFrames = (frames, hasEnvelope)->
  frames = Array.prototype.slice.call(frames)

  if hasEnvelope
    envelope = frames[0]
    protocol = frames[1].toString('ascii')
    type = frames[2].readInt8(0)
    service = frames[3]
    data = frames[5]
  else
    protocol = frames[0].toString('ascii')
    type = frames[1].readInt8(0)
    service = frames[2]
    data = frames[4]
  if protocol is protocols.client
    if type is types.client.REQUEST
      logger.debug('types.client.REQUEST')
      return new ClientRequestMessage(service, data, envelope)
    else if type is types.client.READY
      logger.debug('types.client.READY')
      return new ClientReadyMessage(service, data, envelope)
    if type is types.client.REQUEST_NR
      logger.debug('types.client.REQUEST_NR')
      return new ClientRequestNoRMessage(service, data, envelope)
    else if type is types.client.RESPONSE
      logger.debug('types.client.RESPONSE')
      return new ClientResponseMessage(service, data, envelope)
    else if type is types.client.HEARTBEAT
      logger.debug('types.client.HEARTBEAT')
      return new ClientHeartbeatMessage(envelope)
  else if protocol is protocols.worker
    
    if type is types.worker.READY
      logger.debug('types.worker.READY')
      return new WorkerReadyMessage(service,data ,envelope)
    else if type is types.worker.REQUEST
      logger.debug('types.worker.REQUEST')
      return new WorkerRequestMessage(service, data)
    else if type is types.worker.RESPONSE
      logger.debug('types.worker.RESPONSE')
      return new WorkerResponseMessage(service, data)
    else if type is types.worker.HEARTBEAT
      logger.debug('types.worker.HEARTBEAT')
      return new WorkerHeartbeatMessage(envelope)
    else if type is types.worker.DISCONNECT
      logger.debug('types.worker.DISCONNECT')
      return new WorkerDisconnectMessage(envelope)
    
module.exports = 
  fromFrames: fromFrames
  client: 
    Message: ClientMessage,
    ReadyMessage: ClientReadyMessage
    RequestMessage: ClientRequestMessage
    RequestNoRMessage: ClientRequestNoRMessage
    ResponseMessage: ClientResponseMessage
    HeartbeatMessage: ClientHeartbeatMessage,
  worker:
    Message: WorkerMessage,
    ReadyMessage: WorkerReadyMessage,
    RequestMessage: WorkerRequestMessage,
    ResponseMessage: WorkerResponseMessage,
    HeartbeatMessage: WorkerHeartbeatMessage,
    DisconnectMessage: WorkerDisconnectMessage
