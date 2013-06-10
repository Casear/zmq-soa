redis = require 'redis'
zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
EventEmitter = require('events').EventEmitter
class Broker extends EventEmitter
  
  constructor:(endpoint,options)->
    @services = {}
    @workers = 0
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
        worklabel= worker.toString('base64')
        @services[service].worker--
        
        if message instanceof messages.client.RequestMessage
          if(@mapping[worklabel])
            logger.error('envelope exist')
          @mapping[worklabel] = message.envelope
          
        r = new messages.worker.RequestMessage(service, message.data,worker ).toFrames()
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
      if message instanceof messages.worker.ResponseMessage
        logger.debug('broker: on worker Response')
        @onWorkerResponse(message, envelope)
      else if message instanceof messages.worker.DisconnectMessage
        logger.debug('broker: on worker Disconnect')
        @onWorkerDisconnect(message);
    
  onClientRequest:(message)->
    if @services.hasOwnProperty(message.service.toString())
      @queue.push(message)
  
  onWorkerResponse:(message,envelope)->   
    logger.debug('onWorkerResponse')
    logger.debug(@mapping)
    workerlabel = envelope.toString('base64')
    if @mapping[workerlabel]
      clientEnvelope = @mapping[workerlabel]
      delete @mapping[workerlabel]
      @socket.send(new messages.client.ResponseMessage(message.service,message.data,clientEnvelope).toFrames())
    else
      logger.debug('onWorkerResponse without response')
    @services[message.service.toString()].waiting.push(envelope)
    @services[message.service.toString()].worker++
  onWorkerReady:(message, envelope)->
    service = message.service.toString()
    logger.debug('on service:'+service+' register')

    unless @services.hasOwnProperty(service)
      @services[service] =
        waiting : []
        worker : 0
    @services[service].worker++
    @services[service].waiting.push(envelope)
    logger.debug(@services)
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