redis = require 'redis'
zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
EventEmitter = require('events').EventEmitter
_ = require 'underscore'
class Broker extends EventEmitter
  
  constructor:(endpoint,options)->
    @services = {}
    @workers = {}
    @clients = {}
    @queue = []  
    @mapping = {}
    @socket = zmq.socket('router')
    logger.info("broker "+endpoint + 'starting')
    @socket.bindSync(endpoint)
    logger.info("broker "+endpoint + ' started')
    @socket.on('message', @onMessage.bind(@));
    setImmediate(@executeQueue.bind(@))
  executeQueue:()->

    if @queue.length >0 
      
      message = @queue.shift()
      logger.debug(message,'executeQueue length:',@queue.length)
      service = message.service.toString()
      logger.debug('request '+service)
      if @services[service].worker > 0
        worker = @services[service].waiting.shift()
        @services[service].waiting.push(worker)
        worklabel= worker
        if message instanceof messages.client.RequestMessage
          if(@mapping[worklabel])
            setImmediate(@executeQueue.bind(@))
          else
            @mapping[worklabel] = message
            r = new messages.worker.RequestMessage(service, message.data,new Buffer(worker,'hex')).toFrames()
            @socket.send(r)
        
      else
        if @services[service]
          @queue.push(message)
    setImmediate(@executeQueue.bind(@))
  onMessage:(envelope, protocol, type)->
    logger.debug('broker on Message')
    logger.debug(arguments)
    message = messages.fromFrames(arguments, true)
    
    if message instanceof messages.client.Message
      
      if message instanceof messages.client.RequestMessage or message instanceof messages.client.RequestNoRMessage
        logger.debug('broker: on client Request')
        @onClientRequest(message);
      if message instanceof messages.client.ReadyMessage
        logger.debug('broker: on client Ready')
        @onClientReady(envelope)
      if message instanceof messages.client.HeartbeatMessage
        logger.debug('broker: on client Heartbeat')
        @onClientHeartBeat( envelope)
    else if message instanceof messages.worker.Message
      
      if message instanceof messages.worker.ReadyMessage
        logger.debug('broker: on worker Ready')
        @onWorkerReady(message,envelope)
      if message instanceof messages.worker.HeartbeatMessage
        logger.debug('broker: on worker heartbeat')
        @onWorkerHeartBeat(message, envelope)
      if message instanceof messages.worker.ResponseMessage
        logger.debug('broker: on worker Response')
        @onWorkerResponse(message, envelope)
      else if message instanceof messages.worker.DisconnectMessage
        logger.debug('broker: on worker Disconnect')
        @onWorkerDisconnect(message);
    else
      logger.error('broker invalid request')
      logger.error(arguments)
      logger.error(message)
     
  onClientReady:(envelope)->
    logger.info('client connect')
    if not @clients[envelope]
      @clients[envelope] = {}
      @clients[envelope].checkHeartbeat = setTimeout((()->
        if @clients[envelope]
          delete @clients[envelope]
        ).bind(@),15000)
  onClientHeartBeat:(envelope)->
    logger.debug('client  heartbeat')
    if @clients[envelope]
      clearTimeout(@clients[envelope].checkHeartbeat)
      @clients[envelope].checkHeartbeat = setTimeout((()->
          delete @clients[envelope]
        ).bind(@),15000)
      @socket.send(new messages.client.HeartbeatMessage(envelope).toFrames())
    else
      @socket.send(new messages.client.ReadyMessage(null,null,envelope).toFrames())
  onWorkerHeartBeat:(message,envelope)->
    logger.debug('worker  heartbeat')
    e = envelope.toString('hex')
    if @workers[e]
      clearTimeout(@workers[e].checkHeartbeat)
      @workers[e].checkHeartbeat = setTimeout((()->
        
        if @workers[e]
          index = _.indexOf(@services[@workers[e].service].waiting, e)
          while index isnt -1
            @services[@workers[e].service].waiting.splice index,1
            @services[@workers[e].service].worker--
            index = _.indexOf(@services[@workers[e].service].waiting, e)
            if @workers[e]
              delete @workers[e]
        ).bind(@),15000)
      @socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames())
    else
      @socket.send(new messages.worker.ReadyMessage(null,null,envelope).toFrames())
  
  onClientRequest:(message)->
    if @services.hasOwnProperty(message.service.toString())
      @queue.push(message)
  
  onWorkerResponse:(message,envelope)->   
    logger.debug('onWorkerResponse')
    logger.debug(@mapping)
    workerlabel = envelope.toString('hex')
    if @mapping[workerlabel]
      clientEnvelope = @mapping[workerlabel].envelope
      mapEnvelope = @mapping[workerlabel].mapping
      delete @mapping[workerlabel]
      @socket.send(new messages.client.ResponseMessage(message.service,message.data,clientEnvelope,mapEnvelope).toFrames())
    else
      logger.debug('onWorkerResponse without response')
    
  onWorkerReady:(message, envelope)->
    console.dir(message)
    service = message.service.toString()
    logger.debug('on service:'+service+' register')
    e = envelope.toString('hex')
    unless @services.hasOwnProperty(service)
      @services[service] =
        waiting : []
        worker : 0
    if message.data
      @workers[e] = JSON.parse(message.data.toString())  
    else
      @workers[e] = {}
    @workers[e].service = service
    if not _.indexOf(@services[service].waiting,e)
      @services[service].worker++
      @services[service].waiting.push(e)
    logger.debug(@services)

    @workers[e].checkHeartbeat = setTimeout((()->
      
      if @workers[e]
        index = _.indexOf(@services[@workers[e].service].waiting,e)
        
        if index isnt -1
          @services[@workers[e].service].waiting.splice index,1
          @services[@workers[e].service].worker--
          delete @workers[e]
      ).bind(@),15000)



  onWorkerDisconnect:(message)->
    

  disconnectWorker:(envelope)->
    @socket.send(new messages.worker.DisconnectMessage(envelope).toFrames())
  disconnect:()->
    keys = Object.keys(this.services);
    unless keys.length
      return
    keys.forEach((service)->
      unless @services[service].workers
        return
      @services[service].waiting.forEach((worker)->
        @disconnectWorker(worker)
      , @)
    , @)

  findServiceBySender : (sender)->
    knownService = ''
    Object.keys(this.services).forEach(
      (service)->
        if @services[service].waiting.some((worker)-> sender.toString() == worker.toString() )
          knownService = service
    , @)
    knownService


  findIndexBySenderService : (sender, service)->
    knownIndex = -1;
    @services[service].waiting.forEach((worker, index)->
      if worker.toString() == sender.toString()
        knownIndex = index
    )
    knownIndex
module.exports = 
  Broker   : Broker