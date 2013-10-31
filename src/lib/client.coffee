zmq = require 'zmq'
messages = require './message'
logger = (require './logger').logger
crypto = require 'crypto'
net = require('net')
rsa = require('./rsaCrypto').rsaCrypto
keySize = 2048
class Client
  constructor:()->
    @connected = false
    @service = null
    @defaultTimeout = 10
    @callback={}
    @callbackTimeout={}
    @options={}
    @host = ''
    @port = ''
    @rsaPub = null
    @signer = null
    @isWorker = false
    @isReady = false
    l = arguments.length
    if l <= 4 and l > 2
      @socket = zmq.socket('dealer')
      @host = arguments[0]
      @port = arguments[1]
      logger.info("tcp://"+@host+":"+@port+' client connecting')
      @socket.connect "tcp://"+@host+":"+@port
      @socket.on 'message',@.onMsg.bind(@)
      if l is 3
        if arguments[2] and typeof(arguments[3]) is 'function'
          @workerCallback = arguments[2]
        else
          @options = arguments[2]
      else if l is 4
        @options = arguments[2]
        if arguments[3] and typeof(arguments[3]) is 'function'
          @workerCallback = arguments[3]
      if @options.service
        @service = @options.service
        @isWorker = true
      if @options.timeout
        defaultTimeout = @options.timeout
      @ready(@options.info)
      @TestReconnect()
  
    
  onMsg:()->
    logger.debug('msg get')
    logger.debug(arguments)
    if arguments.length is 2
      logger.debug('msg try to descrypt')
      s = new Buffer(arguments[1].toString(),'base64')
      d = new Buffer(arguments[0].toString(),'base64')
      if @signer 
        if @signer.Verify(d,s)          
          try  
            decipher = crypto.createDecipheriv('des3', @key , @iv)
            decrypted = decipher.update(d,'binary','hex')
            decrypted += decipher.final('hex')
            data = new Buffer(decrypted,'hex')
            message = messages.fromJSON(JSON.parse(data.toString()))
            logger.debug(data.toString())
            logger.debug(message)
            logger.debug('Decrypt Success')
          catch ex
            logger.error ex
            return
        else
          logger.debug('Signature failed')
          return
      else
        logger.debug('msg is not Ready')
        return
    else
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
    else if msg instanceof messages.client.HandshakeMessage
      logger.debug('client get auth message')
      @onClientHandshake(msg)
    else if msg instanceof messages.client.AuthMessage
      logger.debug('client get auth message')
      @onClientAuth(msg)
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
    else if msg instanceof messages.worker.HandshakeMessage
      logger.debug('worker get handshake message')
      @onWorkerHandshake(msg)
    else if msg instanceof messages.worker.AuthMessage
      logger.debug('worker get auth message')
      @onWorkerAuth(msg)
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
          time : frames[4]
          data : frames[6].toString()
        }
      )
  

  sendHeartbeat:()->
    logger.debug('Send Heartbeat')
    if @disconnected
      clearTimeout(@disconnected)
    if(@isWorker)
        @socket.send(new messages.worker.HeartbeatMessage().toFrames())
    else
      @socket.send(new messages.client.HeartbeatMessage().toFrames()) 
    if @connected
      @disconnected = setTimeout (()-> 
        @connected = false
        @auth = false
        logger.error('disconnected')
        if @onDisconnect
          @onDisconnect()
        @TestReconnect()
      ).bind(@),20000

  onHeartbeat:(worker)->
    logger.debug('worker : received heartbeat request')
    if @disconnected
      clearTimeout(@disconnected)
    if not @connected
      @connected = true
      if @onConnect
        @onConnect()

    setTimeout (()->
      @sendHeartbeat()
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
      logger.debug(msg)
      cb = (returnMsg)->
        r = new messages.worker.ResponseMessage(msg.service,returnMsg,null,msg.mapping)
        @socket.send(r.toFrames()) 
      @workerCallback(msg.data, cb.bind(@))
  auth:(data)->

    
  ready:(data)->
    logger.error('Ready')
    ###
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
    ###
  





  onWorkerHandshake:(msg)->
    logger.debug('')
    if msg.data
      pub = msg.data.toString()
      if @rsaPub
        if @pubKey is @isReady 
          return
        else
          logger.info("Change Key")
          @rsaPub = new rsa(keySize,pub)  
          @pubKey = pub    
      else        
          logger.info("Initial Key")
          @rsaPub = new rsa(keySize,pub)  
          @pubKey = pub
    else
      @rsaPub = null
    logger.debug('Start Handshake')
    @Handshake()

  Handshake:()->
    if @rsaPub
      logger.info('Get Handshake Key')
      @key = crypto.randomBytes(24)
      @iv = crypto.randomBytes(8)
      @signer = new rsa(2048)

      tripleKey = @key.toString('base64')+','+@iv.toString('base64')+','+@signer.toPem(false)+','+(new Date()).getTime()
      content = @rsaPub.Encrypt(new Buffer(tripleKey))
      if @service
        logger.info "Send Handshake DES Key"
        @socket.send(new messages.worker.HandshakeMessage(content).toFrames())
        @sendHeartbeat()
      else
        logger.info "Send Handshake DES Key"
        @socket.send(new messages.client.HandshakeMessage(content).toFrames())
        @sendHeartbeat()
    else
      logger.info("Get Reconnect Command")
      @TestReconnect()

  send:(service,msg,callback,timeout)->
    buf = new Buffer( Math.floor(Math.random()*(128-1)+0) for num in [1..5])
    logger.debug(  'client : sending '+msg+' connected:'+@connected)
    if @connected
      if callback
        @socket.send(new messages.client.RequestMessage(service, msg,null,buf,timeout).toFrames());
      else
        @socket.send(new messages.client.RequestNoRMessage(service, msg,null,timeout).toFrames());
      logger.debug(  'client : sent '+msg)
      if callback
        hex = buf.toString('hex')
        @callback[hex] = callback
        logger.debug('timeout '+(timeout or @defaultTimeout)*1000)
        @callbackTimeout[hex] = setTimeout((()->
          if @callback[hex]
            logger.error('client sending timeout. service:'+service + ' message:'+msg)
            @callback[hex]('response timeout')
          delete @callback[hex]
          delete @callbackTimeout[hex]
        ).bind(@), (timeout or @defaultTimeout)*1000)
    else
      logger.error('client disconnected ')
      if callback
        callback('connect failed')
  



  SendWithEncrypt:(msg)->
    
    
    cipher = crypto.createCipheriv('des3', i, v) 
    crypted = cipher.update(JSON.stringify(msg),'utf8','hex')
    crypted += cipher.final('hex')
    data = new Buffer(crypted,'hex')
    hash = @rsaCrypto.Sign(data)
    @socket.send([data.toString('base64'),hash])
  TestReconnect:()->
    if not @connected  
      @CheckNetwork ((result)->
        if result
          logger.debug("Connect IP and Port Correct")
          if @service
            logger.debug("start worker handshake")
            @socket.send(new messages.worker.HandshakeMessage().toFrames())
          else
            logger.debug("start worker handshake")
            @socket.send(new messages.client.HandshakeMessage().toFrames()) 
          setTimeout((()->
            if not @connected
              logger.debug("start Reconnect")
              @TestReconnect()
            else
              logger.debug("Already Connect")
          ).bind(@),20000)
        else
          logger.error('Connect IP and Port Failed')
          setTimeout((()->
            if not @connected
              @TestReconnect()
          ).bind(@),20000)
        ).bind(@)
    

  CheckNetwork:(cb)->
    client = net.connect({port:@port,host:@host}, ()->
      client.end()
      cb(true)
    )
    client.on('error',()->
      cb(false)
    )



module.exports = 
  Client : Client
