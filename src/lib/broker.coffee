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
      logger.debug(message)
      logger.debug('executeQueue length:'+@queue.length)
      service = message.service.toString()
      logger.debug('request '+service)
      if @services[service].worker > 0
        
        worker = @services[service].waiting.shift()
        worklabel= worker
        @services[service].worker--
        
        if message instanceof messages.client.RequestMessage
          if(@mapping[worklabel])
            logger.error('envelope exist')
          @mapping[worklabel] = message.envelope
          
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
    else if message instanceof messages.worker.Message
      
      if message instanceof messages.worker.ReadyMessage
        logger.debug('broker: on worker Ready')
        @onWorkerReady(message, envelope)
      if message instanceof messages.worker.HeartbeatMessage
        logger.debug('broker: on worker Ready')
        @onWorkerHeartBeat(message, envelope)
      if message instanceof messages.worker.ResponseMessage
        logger.debug('broker: on worker Response')
        @onWorkerResponse(message, envelope)
      else if message instanceof messages.worker.DisconnectMessage
        logger.debug('broker: on worker Disconnect')
        @onWorkerDisconnect(message);
  onWorkerHeartBeat:(message,envelope)->
    logger.debug('worker  heartbeat')
    logger.debug(arguments)
    if @workers[envelope]
      clearTimeout(@workers[envelope].checkHeartbeat)
      @workers[envelope].checkHeartbeat = setTimeout((()->
        
        if @workers[envelope]
          index = _.indexOf(@services[@workers[envelope].service].waiting,envelope.toString('hex'))
        
          if index isnt -1
            @services[@workers[envelope].service].waiting.splice index,1
            @services[@workers[envelope].service].worker--
            delete @workers[envelope]
        ).bind(@),15000)
      @socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames())
    else
      @socket.send(new messages.worker.ReadyMessage(null,null,envelope).toFrames())
  onClientHeartBeat:(message,envelope)->
    logger.debug('client  heartbeat')
    logger.debug(arguments)
    if @clients[envelope]
      clearTimeout(@clients[envelope].checkHeartbeat)
      @clients[envelope].checkHeartbeat = setTimeout((()->
        if @clients[envelope]
          delete @clients[envelope]
        ).bind(@),15000)
      @socket.send(new messages.client.HeartbeatMessage(envelope).toFrames())

  onClientRequest:(message)->
    if @services.hasOwnProperty(message.service.toString())
      @queue.push(message)
  
  onWorkerResponse:(message,envelope)->   
    logger.debug('onWorkerResponse')
    logger.debug(@mapping)
    workerlabel = envelope.toString('hex')
    if @mapping[workerlabel]
      clientEnvelope = @mapping[workerlabel]
      delete @mapping[workerlabel]
      @socket.send(new messages.client.ResponseMessage(message.service,message.data,clientEnvelope).toFrames())
    else
      logger.debug('onWorkerResponse without response')
    @services[message.service.toString()].waiting.push(workerlabel)
    @services[message.service.toString()].worker++
  onWorkerReady:(message, envelope)->
    service = message.service.toString()
    logger.debug('on service:'+service+' register')
    
    unless @services.hasOwnProperty(service)
      @services[service] =
        waiting : []
        worker : 0
    if message.data
      @workers[envelope] = JSON.parse(message.data.toString())  
    else
      @workers[envelope] = {}
    @workers[envelope].service = service
    @services[service].worker++
    @services[service].waiting.push(envelope.toString('hex'))
    logger.debug(@services)

    @workers[envelope].checkHeartbeat = setTimeout((()->
      
      if @workers[envelope]
        index = _.indexOf(@services[@workers[envelope].service].waiting,envelope.toString('hex'))
        
        if index isnt -1
          @services[@workers[envelope].service].waiting.splice index,1
          @services[@workers[envelope].service].worker--
          delete @workers[envelope]
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