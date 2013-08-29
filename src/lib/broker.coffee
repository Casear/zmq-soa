redis = require 'redis'
zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
EventEmitter = require('events').EventEmitter
_ = require 'underscore'
heartbeatTime = 20000
class Broker extends EventEmitter
  
  constructor:(endpoint,options,log)->
    @services = {}
    @workers = {}
    @clients = {}
    @queue = []  
    @mapping = {}
    @socket = zmq.socket('router')
    if log
      logger = log
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
        if message.mapping
          worklabel= message.mapping.toString('hex')
        if message instanceof messages.client.RequestMessage or message instanceof messages.client.RequestNoRMessage   
          if message instanceof messages.client.RequestMessage
            @mapping[worklabel] = message
            @Timeout.bind(@)(worklabel,message.time*1000)
          r = new messages.worker.RequestMessage(service, message.data,new Buffer(worker,'hex'),message.mapping,message.time).toFrames()
          @socket.send(r)
          
        
      else
        if @services[service]
          @queue.push(message)
    setImmediate(@executeQueue.bind(@))
  Timeout:(worklabel,time)->
    setTimeout (()->
       if @mapping[worklabel]
        clientEnvelope = @mapping[worklabel].envelope
        mapEnvelope = @mapping[worklabel].mapping
        @socket.send(new messages.client.ResponseMessage(@mapping[worklabel].service,JSON.stringify({result:0,err:'服務回應逾時'}),clientEnvelope,mapEnvelope).toFrames())
        logger.error(worklabel," to ",@mapping[worklabel].service.toString() , ' Timeout')
        delete @mapping[worklabel]
      ).bind(@)
    ,time


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
    e = envelope.toString('hex')
    if not @clients[e]
      @clients[e] = {}
      @clients[e].checkHeartbeat = setTimeout((()->
        if @clients[e]
          delete @clients[e]
        ).bind(@),heartbeatTime)
  onClientHeartBeat:(envelope)->
    logger.debug('client  heartbeat')
    e = envelope.toString('hex')
    if @clients[e]
      clearTimeout(@clients[e].checkHeartbeat)
      @clients[e].checkHeartbeat = setTimeout((()->
          delete @clients[e]
        ).bind(@),heartbeatTime)
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
        ).bind(@),heartbeatTime)
      @socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames())
    else
      @socket.send(new messages.worker.ReadyMessage(null,null,envelope).toFrames())
  
  onClientRequest:(message)->
    if @services.hasOwnProperty(message.service.toString())
      @queue.push(message)
      logger.info(message.envelope.toString('hex')," to ",message.service.toString())
    else
      clientEnvelope = message.envelope
      mapEnvelope = message.mapping  
      @socket.send(new messages.client.ResponseMessage(message.service,JSON.stringify({result:0,err:'服務不存在'}),clientEnvelope,mapEnvelope).toFrames())
      logger.info(message.envelope.toString('hex')," to ",message.service + " not exist")
  
  onWorkerResponse:(message,envelope)->   
    logger.debug('onWorkerResponse')
    logger.debug(@mapping)
    if message.mapping
      workerlabel = message.mapping.toString('hex')
      if @mapping[workerlabel]
        clientEnvelope = @mapping[workerlabel].envelope
        mapEnvelope = @mapping[workerlabel].mapping
        delete @mapping[workerlabel]
        @socket.send(new messages.client.ResponseMessage(message.service,message.data,clientEnvelope,mapEnvelope).toFrames())
        logger.info(workerlabel," to ",message.service.toString() , ' return')
      else
        logger.debug('onWorkerResponse without response')
    
  onWorkerReady:(message, envelope)->
    logger.debug(message)
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
    if _.indexOf(@services[service].waiting,e) is -1
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
      ).bind(@),heartbeatTime)



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