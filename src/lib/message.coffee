logger = require('./logger').logger
protocols = 
  client: 'MDPC02'
  worker: 'MDPW02'

defaultTimeout = 5

types = 
  client: 
    READY:0x01
    REQUEST: 0x02
    REQUEST_NR: 0x03
    RESPONSE: 0x04
    HEARTBEAT: 0x05
    Handshake: 0x06
    AUTH:0x07
  worker: 
    READY: 0x01
    REQUEST: 0x02
    RESPONSE: 0x03
    HEARTBEAT: 0x04
    DISCONNECT: 0x05
    Handshake: 0x06
    AUTH: 0x07

class Message 
  constructor:(@protocol, @type, @service, @data, @envelope,@mapping,@time)->
  toFrames :()->
    frames = []
    if @envelope
      frames.push(@envelope)
    frames.push(@protocol)
    frames.push(new Buffer([@type]))
    if @service
      frames.push(@service)
    else
      frames.push('') 
    if @mapping
      frames.push(@mapping)
    else
      frames.push('')
    if @time
      frames.push(new Buffer([@time]))
    else
      frames.push(new Buffer([defaultTimeout]))
    if @data
      frames.push('')
      if Array.isArray(@data)
        frames = frames.concat(@data)
      else
        frames.push(@data)
    
    frames;

 
class ClientMessage extends Message
  constructor:(type, service, data, envelope,mapping,time)->
    if not time
      time = defaultTimeout
    super(protocols.client,type, service, data, envelope,mapping,time)
class WorkerMessage extends Message
  constructor:(type, service, data, envelope,mapping,time)->
    if not time
      time = defaultTimeout
    super(protocols.worker,type, service, data, envelope,mapping,time)

class ClientReadyMessage extends ClientMessage
  constructor:(envelope)->
    if not time
      time = defaultTimeout
    super(types.client.READY,null,null,envelope)
class ClientRequestMessage extends ClientMessage
  constructor:(service, data, envelope,mapping,time)->
    if not time
      time = defaultTimeout
    super(types.client.REQUEST,service,data,envelope,mapping,time)
class ClientRequestNoRMessage extends ClientMessage
  constructor:(service, data, envelope,time)->
    if not time
      time = defaultTimeout
    super(types.client.REQUEST_NR,service,data,envelope,time)
class ClientResponseMessage extends ClientMessage
  constructor:(service, data, envelope,mapping,time)->
    if not time
      time = defaultTimeout
    super(types.client.RESPONSE,service,data,envelope,mapping,time)
class ClientHeartbeatMessage extends ClientMessage
  constructor:(envelope)->
    if not time
      time = defaultTimeout
    super(types.client.HEARTBEAT,null,null,envelope)
class ClientAuthMessage extends ClientMessage
  constructor:(data,envelope)->
    if not time
      time = defaultTimeout
    super(types.client.AUTH,null,data,envelope)
class ClientHandshakeMessage extends ClientMessage
  constructor:(data,envelope)->
    if not time
      time = defaultTimeout
    super(types.client.Handshake,null,data,envelope)

    
class WorkerReadyMessage extends WorkerMessage
  constructor:(envelope,time)->
    if not time
      time = defaultTimeout
    super(types.worker.READY,null,null,envelope,null,time)

class WorkerRequestMessage extends WorkerMessage
  constructor:(service, data, envelope,mapping,time)->
    if not time
      time = defaultTimeout
    super(types.worker.REQUEST,service,data,envelope,mapping,time)

class WorkerResponseMessage extends WorkerMessage
  constructor:(service, data, envelope,mapping ,time)->
    if not time
      time = defaultTimeout
    super(types.worker.RESPONSE,service,data,envelope,mapping,time)

class WorkerHeartbeatMessage extends WorkerMessage 
  constructor:(envelope,time)->
    if not time
      time = defaultTimeout
    super(types.worker.HEARTBEAT,null,null,envelope,null,time)
class WorkerDisconnectMessage extends WorkerMessage 
  constructor:(envelope,time)->
    if not time
      time = defaultTimeout
    super(types.worker.DISCONNECT,null,null,envelope,null,time)
class WorkerAuthMessage extends WorkerMessage 
  constructor:(service,data,envelope,time)->
    if not time
      time = defaultTimeout
    super(types.worker.AUTH,null,data,envelope,null,time)
class WorkerHandshakeMessage extends WorkerMessage 
  constructor:(data,envelope,time)->
    if not time
      time = defaultTimeout
    super(types.worker.Handshake,null,data,envelope,null,time)

fromJSON = (frames)->

  envelope = frames.Envelope
  if frames.Protocol is 0
    protocol = 'MDPW02'
  else
    protocol = 'MDPC02'

  type = frames.SendType
  service = frames.Service
  mapping = frames.Mapping
  if frames.Time
    time = frames.Time
  else
    time = 5
  if frames.Data
    data = new Buffer(frames.Data,'base64')
  logger.debug(frames)
  console.dir protocol
  console.dir type
  if protocol is protocols.client
      logger.debug('types.client')
      if type is types.client.REQUEST
        logger.debug('types.client.REQUEST')
        return new ClientRequestMessage(service, data, envelope, mapping, time)
      else if type is types.client.READY
        logger.debug('types.client.READY')
        return new ClientReadyMessage(service, data, envelope,time)
      if type is types.client.REQUEST_NR
        logger.debug('types.client.REQUEST_NR')
        return new ClientRequestNoRMessage(service, data, envelope,time)
      else if type is types.client.RESPONSE
        logger.debug('types.client.RESPONSE')
        return new ClientResponseMessage(service, data, envelope,mapping,time)
      else if type is types.client.HEARTBEAT
        logger.debug('types.client.HEARTBEAT')
        return new ClientHeartbeatMessage(envelope,time)
      else if type is types.client.AUTH
        logger.debug('types.client.AUTH')
        return new ClientAuthMessage(data,envelope,time)
      else if type is types.client.Handshake
        logger.debug('types.client.Handshake')
        return new ClientHandshakeMessage(data,envelope,time)
    else if protocol is protocols.worker
      logger.debug('types.woker')
      if type is types.worker.READY
        logger.debug('types.worker.READY')
        return new WorkerReadyMessage(service,data ,envelope,time)
      else if type is types.worker.REQUEST
        logger.debug('types.worker.REQUEST')
        return new WorkerRequestMessage(service, data, envelope ,mapping,time)
      else if type is types.worker.RESPONSE
        logger.debug('types.worker.RESPONSE')
        return new WorkerResponseMessage(service, data, envelope,mapping,time)
      else if type is types.worker.HEARTBEAT
        logger.debug('types.worker.HEARTBEAT')
        return new WorkerHeartbeatMessage(envelope,time)
      else if type is types.worker.DISCONNECT
        logger.debug('types.worker.DISCONNECT')
        return new WorkerDisconnectMessage(envelope,time)
      else if type is types.worker.AUTH
        logger.debug('types.worker.AUTH')
        return new WorkerAuthMessage(data,envelope,time)
      else if type is types.worker.Handshake
        logger.debug('types.worker.Handshake')
        return new WorkerHandshakeMessage(data,envelope,time)
fromFrames = (frames, hasEnvelope)->
  try
    frames = Array.prototype.slice.call(frames)
    if frames.length < 2
      null
    else
      if hasEnvelope
        envelope = frames[0]

        protocol = frames[1].toString('ascii')
        type = frames[2].readInt8(0)
        service = frames[3]
        mapping = frames[4]
        try
          time = frames[5].readInt8(0)
        catch
          time = 5
        data = frames[7]
      else
   
        protocol = frames[0].toString('ascii')
        type = frames[1].readInt8(0)
        service = frames[2]
        mapping = frames[3]
        try
          time = frames[4].readInt8(0)
        catch
          time = 5
        data = frames[6]
      logger.debug(protocol)
      if protocol is protocols.client
        logger.debug('types.client')
        if type is types.client.REQUEST
          logger.debug('types.client.REQUEST')
          return new ClientRequestMessage(service, data, envelope, mapping, time)
        else if type is types.client.READY
          logger.debug('types.client.READY')
          return new ClientReadyMessage(service, data, envelope,time)
        if type is types.client.REQUEST_NR
          logger.debug('types.client.REQUEST_NR')
          return new ClientRequestNoRMessage(service, data, envelope,time)
        else if type is types.client.RESPONSE
          logger.debug('types.client.RESPONSE')
          return new ClientResponseMessage(service, data, envelope,mapping,time)
        else if type is types.client.HEARTBEAT
          logger.debug('types.client.HEARTBEAT')
          return new ClientHeartbeatMessage(envelope,time)
        else if type is types.client.AUTH
          logger.debug('types.client.AUTH')
          return new ClientAuthMessage(data,envelope,time)
        else if type is types.client.Handshake
          logger.debug('types.client.Handshake')
          return new ClientHandshakeMessage(data,envelope,time)
      else if protocol is protocols.worker
        logger.debug('types.woker')
        if type is types.worker.READY
          logger.debug('types.worker.READY')
          return new WorkerReadyMessage(service,data ,envelope,time)
        else if type is types.worker.REQUEST
          logger.debug('types.worker.REQUEST')
          return new WorkerRequestMessage(service, data, envelope ,mapping,time)
        else if type is types.worker.RESPONSE
          logger.debug('types.worker.RESPONSE')
          return new WorkerResponseMessage(service, data, envelope,mapping,time)
        else if type is types.worker.HEARTBEAT
          logger.debug('types.worker.HEARTBEAT')
          return new WorkerHeartbeatMessage(envelope,time)
        else if type is types.worker.DISCONNECT
          logger.debug('types.worker.DISCONNECT')
          return new WorkerDisconnectMessage(envelope,time)
        else if type is types.worker.AUTH
          logger.debug('types.worker.AUTH')
          return new WorkerAuthMessage(data,envelope,time)
        else if type is types.worker.Handshake
          logger.debug('types.worker.Handshake')
          return new WorkerHandshakeMessage(data,envelope,time)
  catch ex
    logger.error('Message格式有誤')
    logger.error(ex)
    null
  logger.error('Message格式有誤')
  logger.error(frames)
  logger.error(
    {
      protocol : protocol
      type : type
      service : service
      mapping : mapping
      time : time
      data : data
    }
  )
    
module.exports = 
  fromFrames: fromFrames
  fromJSON: fromJSON
  client: 
    Message: ClientMessage,
    ReadyMessage: ClientReadyMessage
    RequestMessage: ClientRequestMessage
    RequestNoRMessage: ClientRequestNoRMessage
    ResponseMessage: ClientResponseMessage
    HeartbeatMessage: ClientHeartbeatMessage
    AuthMessage:ClientAuthMessage
    HandshakeMessage:ClientHandshakeMessage
  worker:
    Message: WorkerMessage
    ReadyMessage: WorkerReadyMessage
    RequestMessage: WorkerRequestMessage
    ResponseMessage: WorkerResponseMessage
    HeartbeatMessage: WorkerHeartbeatMessage
    DisconnectMessage: WorkerDisconnectMessage
    AuthMessage:WorkerAuthMessage
    HandshakeMessage:WorkerHandshakeMessage
