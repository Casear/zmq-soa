zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
crypto = require 'crypto'
class Client
  constructor:()->
    @connected = false
    @service = ''
    @defaultTimeout = 10000
    @callback={}
    @callbackTimeout={}
    @options={}
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
          @options = arguments[1]
      else if l is 3
        @options = arguments[1]
        if arguments[2] and typeof(arguments[2]) is 'function'
          @workerCallback = arguments[2]
      if @options.service
        @service = @options.service
      if @options.timeout
        defaultTimeout = @options.timeout
      @ready(@options.info)
    setInterval (()->
        if not @connected
          @ready(@options.info)
      ).bind(@)
    , 1000*3
      
    
  onMsg:()->
    logger.debug('worker get message')
    logger.debug(arguments)
    msg = messages.fromFrames(arguments,false)
    logger.debug(msg)
    if msg instanceof messages.client.ReadyMessage
      logger.debug('client get ready message')
      @ready(@options)
    else if msg instanceof messages.client.ResponseMessage
      logger.debug('client get response message')
      @onClientMessage(msg)
    else if msg instanceof messages.client.HeartbeatMessage
      logger.debug('client get heartbeat message')
      @onHeartbeat(@options.service)
    else if msg instanceof messages.worker.ReadyMessage
      logger.debug('worker need to send ready message')
      @ready(@options)
    else if msg instanceof messages.worker.RequestMessage
      logger.debug('worker get request message')
      @onWorkerMessage(msg)
    else if msg instanceof messages.worker.DisconnectMessage
      logger.debug('worker get disconnected message')
      @onDisconnect(msg)
    else if msg instanceof messages.worker.HeartbeatMessage
      logger.debug('worker get heartbeat message')
      @onHeartbeat(@options.service)
    else
      logger.error('client invalid request')
      logger.error(arguments)
      logger.error(msg)
      frames = Array.prototype.slice.call(arguments)
      logger.error(
        {
          protocol : frames[0].toString('ascii')
          type : frames[1].readInt8(0)
          service : frames[2].toString()
          mapping : frames[3]
          data : frames[5].toString()
        }
      )
  onDisconnect:()->
    logger.info('worker : received disconnect request')
    @socket.disconnect(@socket.last_endpoint)
    @connected = false
  onHeartbeat:(worker)->
    logger.debug('worker : received heartbeat request')
    if @disconnected
      clearTimeout(@disconnected)
    @connected = true
    
    setTimeout (()->
      if(worker)
        @socket.send(new messages.worker.HeartbeatMessage().toFrames())
      else
        @socket.send(new messages.client.HeartbeatMessage().toFrames()) 
      if @connected
        @disconnected = setTimeout (()-> 
          @connected = false
          logger.error('disconnected')
        ).bind(@),15000
    ).bind(@),10000
  onClientMessage:(msg)->
    if msg.mapping
      logger.debug('------------------mapping---------------')
      hex = msg.mapping.toString('hex')
      if msg.mapping and @callback[hex]
        logger.debug('------------------callback---------------')
        @callback[hex](null, msg.data)
        delete @callback[hex]
        delete @callbackTimeout[hex]
      else
        logger.debug('------------------callback not found---------------')
    else
      logger.debug('------------------mapping not found---------------')
  onWorkerMessage:(msg)->
    logger.debug('onWorkerMessage')
    if @workerCallback
      logger.debug('run workerCallback')
      cb = (returnMsg)->
        r = new messages.worker.ResponseMessage(msg.service,returnMsg)
        @socket.send(r.toFrames()) 
      @workerCallback(msg.data, cb.bind(@))
  ready:(data)->
    
    if @service
      logger.info('worker: '+@service + ' ready')
      unless @connected
        logger.warn('worker send ready message');
        if @disconnected
          clearTimeout(@disconnected)
        @socket.send(new messages.worker.ReadyMessage(@service,JSON.stringify(data)).toFrames())
        @socket.send(new messages.worker.HeartbeatMessage().toFrames())
      else
        logger.warn('worker is already connected to the broker'); 
    else
      logger.info('client: ready')
      unless @connected
        if @disconnected
          clearTimeout(@disconnected)
        @socket.send(new messages.client.ReadyMessage().toFrames())
        @socket.send(new messages.client.HeartbeatMessage().toFrames())
      else
        logger.warn('client is already connected to the broker'); 
  send:(service,msg,callback,timeout)->
    buf = new Buffer( Math.floor(Math.random()*(128-1)+0) for num in [1..5])
    logger.debug(  'client : sending '+msg+' connected:'+@connected)
    if @connected
      if callback
        @socket.send(new messages.client.RequestMessage(service, msg,null,buf).toFrames());
      else
        @socket.send(new messages.client.RequestNoRMessage(service, msg,null).toFrames());
      logger.debug(  'client : sent '+msg)
      if callback
        hex = buf.toString('hex')
        @callback[hex] = callback
        @callbackTimeout[hex] = setTimeout((()->
          if @callback[hex]
            logger.error('client sending timeout. service:'+service + ' message:'+msg)
            @callback[hex]('response timeout')
          delete @callback[hex]
          delete @callbackTimeout[hex]
        ).bind(@), timeout or @defaultTimeout)
    else
      logger.error('client disconnected ')
      if callback
        callback('connect failed')
      
module.exports = 
  Client : Client