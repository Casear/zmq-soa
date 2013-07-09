zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
crypto = require 'crypto'
class Client
  
  
  constructor:()->
    @_isConnect = false
    @done = false
    @service = ''
    @defaultTimeout = 10000
    @callback={}
    @callbackTimeout={}
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
      @ready(options.info)
    
      
    
  onMsg:()->
    logger.debug('worker get message')
    logger.debug(arguments)
    msg = messages.fromFrames(arguments,false)
    logger.debug(msg)
    if msg instanceof messages.client.ResponseMessage
      logger.debug('client get response message')
      @onClientMessage(msg)
    else if msg instanceof messages.worker.ReadyMessage
      logger.debug('worker need to send ready message')
      ready()
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
  onHeartbeat:(worker)->
    logger.debug('worker : received heartbeat request')
    if @disconnected
      clearTimeout(@disconnected)
    @connected = true
    console.log('connected:'+@connected)
    setTimeout (()->
      if(worker)
        @socket.send(new messages.worker.HeartbeatMessage().toFrames())
      else
        @socket.send(new messages.client.HeartbeatMessage().toFrames())
      if @conneted
        @disconnected = setTimeout (()-> @conneted = false).bind(@),15000
    ).bind(@),10000
  onClientMessage:(msg)->
    
    hex = msg.envelope.toString('hex')
    if msg.envelope and @callback[hex]
      @callback[hex](null, JSON.parse(msg.data))
      delete @callback[hex]
      delete @callbackTimeout[hex]
  onWorkerMessage:(msg)->
    logger.debug('onWorkerMessage')
    if @workerCallback
      logger.debug('run workerCallback')
      cb = (returnMsg)->
        r = new messages.worker.ResponseMessage(msg.service,JSON.stringify(returnMsg))
        @socket.send(r.toFrames()) 
      @workerCallback(JSON.parse(msg.data), cb.bind(@))
  ready:(data)->
    if @service
      logger.info('worker: '+@service + ' ready')
      unless @connected
        logger.warn('worker send ready message');
        @socket.send(new messages.worker.ReadyMessage(@service,JSON.stringify(data)).toFrames())
        @socket.send(new messages.worker.HeartbeatMessage().toFrames())
      else
        logger.warn('worker is already connected to the broker'); 
    else
      logger.info('client: ready')
      unless @connected
        @socket.send(new messages.client.ReadyMessage().toFrames())
        @socket.send(new messages.client.HeartbeatMessage().toFrames())
      else
        logger.warn('client is already connected to the broker'); 
  send:(service,msg,callback,timeout)->
    crypto.randomBytes 4,((ex,buf)->
      logger.debug(  'client : sending '+msg+' connected:'+@connected)
      if @connected
        if callback
          @socket.send(new messages.client.RequestMessage(service, JSON.stringify(msg),buf).toFrames());
        else
          @socket.send(new messages.client.RequestNoRMessage(service, JSON.stringify(msg),buf).toFrames());
        logger.debug(  'client : sent '+msg)
        if callback
          hex = buf.toString('hex')
          @callback[hex] = callback
          @callbackTimeout[hex] = setTimeout((()->
            if @callback[hex]
              logger.error('client sending timeout. service:'+service + ' message:'+msg)
              @callback[buf.toString('hex')]('response timeout')
            delete @callback[hex]
            delete @callbackTimeout[hex]
          ).bind(@), timeout or @defaultTimeout)
      else
        logger.error('client disconnected ')
        if callback
          callback('connect failed')
      ).bind(@)
module.exports = 
  Client : Client