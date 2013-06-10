zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger

class Client
  
  
  constructor:()->
    @_isConnect = false
    @done = false
    @service = ''
    @defaultTimeout = 10000
    l = arguments.length
    
    if l <= 3 and l > 1

      @socket = zmq.socket('dealer')
      logger.info(arguments[0]+' client connecting')
      @socket.connect arguments[0]
      @socket.on 'message',@.onMsg.bind(@)
      if l is 2
        if arguments[1] and typeof(arguments[2]) is 'function'
          @workerCallback = arguments[1]
        else
          options = arguments[1]
      else if l is 3
        options = arguments[1]
        if arguments[2] and typeof(arguments[2]) is 'function'
          @workerCallback = arguments[2]
      if options.service
        @service = options.service
      if options.timeout
        defaultTimeout = options.timeout
      @ready()
    
      
    
  onMsg:()->
    logger.debug('worker get message')
    logger.debug(arguments)
    msg = messages.fromFrames(arguments,false)
    logger.debug(msg)
    if msg instanceof messages.client.ResponseMessage
      logger.debug('client get response message')
      @onClientMessage(msg)
    else if msg instanceof messages.worker.RequestMessage
      logger.debug('worker get request message')
      @onWorkerMessage(msg)
    else if msg instanceof messages.worker.DisconnectMessage
      logger.debug('worker get disconnected message')
      @onDisconnect(msg)
    else if msg instanceof messages.worker.HeartbeatMessage
      logger.debug('worker get heartbeat message')
      @onHeartbeat(msg)
    else
      logger.error('invalid request')
  
  onDisconnect:()->
    logger.info('worker : received disconnect request')
    @socket.disconnect(@socket.last_endpoint)
    @connected = false
  
  onClientMessage:(msg)->
    clearTimeout(@timeout)
    @done = true
    if @callback
      @callback(null, JSON.parse(msg.data))
      delete @callback
  onWorkerMessage:(msg)->
    logger.debug('onWorkerMessage')
    if @workerCallback
      logger.debug('run workerCallback')
      cb = (returnMsg)->
        r = new messages.worker.ResponseMessage(msg.service,JSON.stringify(returnMsg))
        @socket.send(r.toFrames()) 
      @workerCallback(JSON.parse(msg.data), cb.bind(@))
  ready:()->
    if @service
      logger.info('worker: '+@service + ' ready')
      unless @connected
        @socket.send(new messages.worker.ReadyMessage(@service).toFrames())
        @connected = true;
      else
        logger.warn('worker is already connected to the broker'); 
    else
      logger.info('client: ready')
      unless @connected
        @socket.send(new messages.client.ReadyMessage().toFrames())
        @connected = true;
      else
        logger.warn('client is already connected to the broker'); 
  send:(service,msg,@callback,timeout)->
    logger.debug(  'client : sending '+msg)
    if @connected
      if @callback
        @socket.send(new messages.client.RequestMessage(service, JSON.stringify(msg)).toFrames());
      else
        @socket.send(new messages.client.RequestNoRMessage(service, JSON.stringify(msg)).toFrames());
      logger.debug(  'client : sent '+msg)
      if @callback
        @timeout = setTimeout((()->
          unless @done
            logger.error('client sending timeout. service:'+service + ' message:'+msg)
            @callback(new Error('timeout'))
          delete @callback;
        ).bind(@), timeout or @defaultTimeout)
    else
      logger.error('client disconnected ')
      if @callback
        @callback(new Error('disconnected'))
module.exports = 
  Client : Client