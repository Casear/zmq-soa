redis = require 'redis'
zmq = require 'zmq'
fs = require 'fs'
crypto = require 'crypto'
messages = require './message'
logger = (require './logger').logger
EventEmitter = require('events').EventEmitter
rsa = require('./rsaCrypto').rsaCrypto
_ = require 'underscore'
ursa = require 'ursa'
heartbeatTime = 20000
keySize = 2048
class Broker extends EventEmitter

  constructor:(endpoint,options,log,@brokerService)->
    @services = {}
    @workers = {}
    @clients = {}
    @queue = []
    @pqueue = []
    @mapping = {}
    @rsaCrypto = {}
    @pubKey = {}
    @privKey = {}
    @socket = zmq.socket('router')
    @Auth = (envelope,data,cb)->
      if data.auth
        if cb
          if data.service
            cb true,envelope,data.service,data
          else
            cb true,envelope,data
        else
          cb false,envelope
      else
        cb false,envelope
    if log
      logger.setLevel('DEBUG');
    else
      logger.setLevel('ERROR');
    if options.cert
      keyContent = fs.readFileSync(options.cert)
      @rsaCrypto = new rsa(keySize,keyContent)
      @pubKey = @rsaCrypto.toPem(false)
      @privKey = @rsaCrypto.toPem(true)
    else if fs.existsSync('./key.pem')
      keyContent = fs.readFileSync('./key.pem')
      @rsaCrypto = new rsa(keySize,keyContent)
      @pubKey = @rsaCrypto.toPem(false)
      @privKey = @rsaCrypto.toPem(true)
    if not ursa.isKey(@pubKey)
      @rsaCrypto = new rsa(keySize)
      @pubKey = @rsaCrypto.toPem(false)
      @privKey = @rsaCrypto.toPem(true)
      fs.writeFileSync('./key.pem',@privKey)
    logger.info("broker "+endpoint + ' starting')
    @socket.bindSync(endpoint)
    logger.info("broker "+endpoint + ' started')
    @socket.on('message', @onMessage.bind(@));
    setTimeout(@executeQueue.bind(@),1)
    setTimeout(@pubQueue.bind(@),1)
  pubQueue:()->
    if @pqueue.length >0
      message = @pqueue.shift()
      logger.debug(message,'pQueue length:',@pqueue.length)

      if @services[message.service].worker > 0
        if @workers[message.worker]
          r = new messages.worker.RequestMessage(message.service, new Buffer(message.data),new Buffer(message.worker,'hex'),null,5)
          @SendWithEncrypt(r)
      else
        if @services[service]
          @pqueue.push(message)
    setTimeout(@pubQueue.bind(@),1)
  executeQueue:()->

    if @queue.length >0
      message = @queue.shift()
      logger.debug(message,'executeQueue length:',@queue.length)

      if message instanceof messages.client.RequestMessage
        service = message.service.toString()
        logger.debug('request '+service)
        if @services[service].worker > 0
          worker = @services[service].waiting.shift()
          @services[service].waiting.push(worker)
          worklabel = null
          if message.mapping
              worklabel = message.mapping.toString('hex')
              @mapping[worklabel] = message
              @Timeout.bind(@)(worklabel,message.time*1000)

          r = new messages.worker.RequestMessage(service, message.data,new Buffer(worker,'hex'),message.mapping,message.time)
          @SendWithEncrypt(r)
        else
          if @services[service]
            @queue.push(message)
      else
        if message.mapping
          @emit('service',worklabel,message)
        else
          @emit('service',worklabel,message,brokerServiceFunc.bind(@))
    setTimeout(@executeQueue.bind(@),1)
  Timeout:(worklabel,time)->
    setTimeout (()->
       if @mapping[worklabel]
        clientEnvelope = @mapping[worklabel].envelope
        mapEnvelope = @mapping[worklabel].mapping
        @SendWithEncrypt new messages.client.TimeoutMessage(clientEnvelope,mapEnvelope)
        logger.error(worklabel," to ",@mapping[worklabel].service.toString() , ' Timeout')
        delete @mapping[worklabel]
      ).bind(@)
    ,time

  onMessage:(envelope)->
    logger.debug('broker on Message')
    e = envelope.toString('hex')
    encrypt = false
    if arguments.length is 3
      if @workers[e]
        logger.debug('worker try to descrypt')
        s = new Buffer(arguments[2].toString(),'base64')
        d = new Buffer(arguments[1].toString(),'base64')
        if @workers[e].isReady
          if @workers[e].s.Verify(d,s)
            decipher = crypto.createDecipheriv('des3', @workers[e].k , @workers[e].i)
            decrypted = decipher.update(d,'binary','hex')
            decrypted += decipher.final('hex')
            data = new Buffer(decrypted,'hex')
            message = messages.fromJSON(JSON.parse(data.toString()),envelope)
            encrypt = true
            logger.debug(data.toString())
            logger.debug(message)
            logger.debug('Decrypt Success')
          else
            logger.debug('Signature failed')
        else
          logger.debug('Worker is not Ready')

      else if @clients[e]
        logger.debug('client try to descrypt')
        s = new Buffer(arguments[2].toString(),'base64')
        d = new Buffer(arguments[1].toString(),'base64')
        if @clients[e].isReady
          if @clients[e].s.Verify(d,s)
            decipher = crypto.createDecipheriv('des3', @clients[e].k , @clients[e].i)
            decrypted = decipher.update(d,'binary','hex')
            decrypted += decipher.final('hex')
            data = new Buffer(decrypted,'hex')
            message = messages.fromJSON(JSON.parse(data.toString()),envelope)
            logger.debug('Client Decrypt Success')
          else
            logger.debug('Client Signature failed')
        else
          logger.debug('Clients is not Ready')
    else
      message = messages.fromFrames(arguments, true)
    if message
      if message instanceof messages.client.Message
        if message instanceof messages.client.RequestMessage
          logger.debug('broker: on client Request')
          @onClientRequest(message,encrypt);
        else if message instanceof messages.client.BServiceMessage
          logger.debug('broker: on client Service')
          @onServiceRequest(message);
        else if message instanceof messages.client.HeartbeatMessage
          @onClientHeartBeat( envelope)
        else if message instanceof messages.client.HandshakeMessage
          logger.debug('broker: on client HandShake')
          @onClientHandshake(message,envelope)
        else if message instanceof messages.client.AuthMessage
          logger.debug('broker: on client Auth')
          @onClientAuth(message,envelope)
      else if message instanceof messages.worker.Message
        if message instanceof messages.worker.HeartbeatMessage
          @onWorkerHeartBeat(message, envelope)
        else if message instanceof messages.worker.ResponseMessage
          logger.debug('broker: on worker Response')
          @onWorkerResponse(message, envelope, encrypt)
        else if message instanceof messages.worker.DisconnectMessage
          logger.debug('broker: on worker Disconnect')
          @onWorkerDisconnect(message,envelope);
        else if message instanceof messages.worker.HandshakeMessage
          logger.debug('broker: on worker Handshake')
          @onWorkerHandshake(message,envelope)
        else if message instanceof messages.worker.AuthMessage
          logger.debug('broker: on worker Auth')
          @onWorkerAuth(message,envelope)
      else
        logger.error('broker invalid request')
        logger.error(arguments)
        logger.error(message)
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

    e = envelope.toString('hex')
    if @clients[e]
      clearTimeout(@clients[e].checkHeartbeat)
      @clients[e].checkHeartbeat = setTimeout((()->
          @emit('disconnect',@clients[e])
          logger.info 'Client '+e+' Disconnect'
        ).bind(@),heartbeatTime)
      @socket.send(new messages.client.HeartbeatMessage(envelope).toFrames())
    else
      @socket.send(new messages.client.ReadyMessage(null,null,envelope).toFrames())
  onWorkerHeartBeat:(message,envelope)->

    e = envelope.toString('hex')
    if @workers[e]
      clearTimeout(@workers[e].checkHeartbeat)
      @workers[e].checkHeartbeat = setTimeout((()->
        if @workers[e]

          if @services[@workers[e].service]
            index = _.indexOf(@services[@workers[e].service].waiting, e)
            while index isnt -1
              @services[@workers[e].service].waiting.splice index,1
              @services[@workers[e].service].worker--
              index = _.indexOf(@services[@workers[e].service].waiting, e)
          @emit('disconnect',@workers[e])
          logger.info 'Service '+@workers[e].service+' Worker '+e+' Disconnect'
          delete @workers[e]
        ).bind(@),heartbeatTime)
      @socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames())
    else
      logger.error 'Worker isnt exist'
      setTimeout((()->
        if not @workers[e]
          logger.debug('Heartbeat Send Handshake')
          @socket.send(new messages.worker.HandshakeMessage(null,null,envelope).toFrames())
        else
          @socket.send(new messages.worker.HeartbeatMessage(envelope).toFrames())
      ).bind(@),5000)
  onClientRequest:(message,encrypt)->
    if @services.hasOwnProperty(message.service.toString())
      @queue.push(message)
      logger.info(message.envelope.toString('hex')," to ",message.service.toString())
    else
      clientEnvelope = message.envelope
      mapEnvelope = message.mapping
      if encrypt
        @SendWithEncrypt new messages.client.ResponseMessage(message.service,JSON.stringify({result:0,err:'服務不存在'}),clientEnvelope,mapEnvelope)
      else
        @SendWithOutEncrypt new messages.client.ResponseMessage(message.service,JSON.stringify({result:0,err:'服務不存在'}),clientEnvelope,mapEnvelope)
      logger.error(message.envelope.toString('hex')," to ",message.service + " not exist")
  onServiceRequest:(message)->
    @queue.push(message)
    logger.debug message
    logger.info(message.envelope.toString('hex')," to Broker")
  onWorkerResponse:(message,envelope,encrypt)->
    logger.debug('onWorkerResponse')
    logger.debug(@mapping)
    if message.mapping
      workerlabel = message.mapping.toString('hex')
      if @mapping[workerlabel]
        clientEnvelope = @mapping[workerlabel].envelope
        mapEnvelope = @mapping[workerlabel].mapping
        delete @mapping[workerlabel]
        if encrypt
          @SendWithEncrypt new messages.client.ResponseMessage(message.service,message.data,clientEnvelope,mapEnvelope)
        else
          @SendWithOutEncrypt new messages.client.ResponseMessage(message.service,message.data,clientEnvelope,mapEnvelope)
        logger.info(workerlabel," to ",message.service.toString() , ' return')
      else
        logger.debug('onWorkerResponse without response')

  onWorkerDisconnect:(message,envelope)->
    e = envelope.toString('hex')
    if @workers[e]
      logger.error('=====disconnect message========')
      logger.error(@workers[e])

  onWorkerAuth:(message,envelope)->
    if message.data
      logger.debug('Worker auth');
      try
        data = JSON.parse(message.data.toString())
        if not @emit('auth',envelope,data,authWorkerFunc.bind(@))
          logger.debug('auth event not defined')
          @Auth envelope,data,authWorkerFunc.bind(@)
      catch ex
        logger.error ex
        @SendWithEncrypt new messages.worker.AuthMessage('','',envelope)
  onClientAuth:(message,envelope)->
    if message.data
      logger.debug('Client auth');
      try
        data = JSON.parse(message.data.toString())
        if not @emit('auth',envelope,data,authClientFunc.bind(@))
          logger.debug('auth event not defined')
          @Auth envelope,data,authClientFunc.bind(@)
      catch ex
        logger.error(ex)
        @SendWithEncrypt new messages.client.AuthMessage('',envelope)
  onWorkerHandshake:(message,envelope)->
    if not message.data
      logger.debug('send Handshake')
      @socket.send(new messages.worker.HandshakeMessage(@pubKey,envelope).toFrames())
      return
    else
      logger.debug('on Handshake')
      e = envelope.toString('hex')
      try
        d = @rsaCrypto.Decrypt(message.data)
        desKey = d.toString().split(',')
        logger.debug(d.toString())
        if desKey.length is 4
          tick = (new Date()).getTime()
          sendTick = parseInt(desKey[3])
          if Math.abs(tick-sendTick)/100000000 <3
            @workers[e] =
              k : new Buffer(desKey[0],'base64')
              i : new Buffer(desKey[1],'base64')
              s : new rsa(keySize,desKey[2])
              isReady : true
            logger.debug("Send ReadyMsg")
            @SendWithEncrypt(new messages.worker.ReadyMessage(envelope))
          else
            logger.error('msg timeout:' + Math.abs(tick-sendTick)/100000000)
      catch
        logger.error('decrypt failed '+message.data.toString())
  onClientHandshake:(message,envelope)->
    logger.debug(message.data)
    if not message.data
      logger.debug('send Handshake')
      @socket.send(new messages.client.HandshakeMessage(@pubKey,envelope).toFrames())
    else
      logger.debug('on Handshake')
      e = envelope.toString('hex')


      try

        d = @rsaCrypto.Decrypt(message.data)
        desKey = d.toString().split(',')
        logger.debug(desKey)
        if desKey.length is 4
          tick = (new Date()).getTime()
          sendTick = parseInt(desKey[3])

          if Math.abs(tick-sendTick)/100000000 <3

            @clients[e] =
              k : new Buffer(desKey[0],'base64')
              i : new Buffer(desKey[1],'base64')
              s : new rsa(keySize,desKey[2])
              isReady : true
            logger.debug("Send ReadyMsg")
            @SendWithEncrypt(new messages.client.ReadyMessage(envelope))
          else
            logger.error('msg timeout')
      catch
        logger.error('decrypt failed '+message.data.toString())
  SendWithEncrypt:(msg)->

    try
      e = msg.envelope.toString('hex')
      if @workers[e] and @workers[e].isReady

        cipher = crypto.createCipheriv('des3', @workers[e].k, @workers[e].i)
        crypted = cipher.update(JSON.stringify(msg),'utf8','hex')
        crypted += cipher.final('hex')
        data = new Buffer(crypted,'hex')
        hash = @rsaCrypto.Sign(data)
        @socket.send([msg.envelope, data.toString('base64'),hash])
        logger.debug('Sent')
      else if @clients[e] and @clients[e].isReady
        cipher = crypto.createCipheriv('des3', @clients[e].k, @clients[e].i)
        crypted = cipher.update(JSON.stringify(msg),'utf8','hex')
        crypted += cipher.final('hex')
        data = new Buffer(crypted,'hex')
        hash = @rsaCrypto.Sign(data)
        @socket.send([msg.envelope, data.toString('base64'),hash])
        logger.debug('Sent')
      else
        logger.error('worker or client #e does not exist')
    catch ex
      logger.error 'Encrypt Failed'
      logger.error ex
  SendWithOutEncrypt:(msg)->

    try
      e = msg.envelope.toString('hex')
      if @workers[e] and @workers[e].isReady
        @socket.send(msg.toFrames())
        logger.debug('Sent')
      else if @clients[e] and @clients[e].isReady
        @socket.send(msg.toFrames())
        logger.debug('Sent')
      else
        logger.error('worker or client #e does not exist')
    catch ex
      logger.error 'Encrypt Failed'
      logger.error ex
  Pub:(service,msg)->
    if @services[service]
      ws = @services[service].waiting
      for worker in ws
        @pqueue.push ({
          service:service
          worker:worker
          data:msg
        })
    else
      logger.info("service:#{service} isnt exist")

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
authClientFunc = (result,envelope,data,auth)->
  if result
    logger.info('Client  Registration')
    e = envelope.toString('hex')
    if @clients[e]
      @clients[e].isAuth = true
      @clients[e].auth = auth
      @SendWithEncrypt new messages.client.AuthMessage(data,envelope)
      @emit 'connect',@clients[e]
    else
      logger.error('client doesn\'t exist')
  else
    logger.error('Authenticate failed')
    @SendWithEncrypt new messages.client.AuthMessage('',envelope)
authWorkerFunc = (result,envelope,service,data,auth)->
  if result
    logger.info('Worker：'+service+' Registration')
    e = envelope.toString('hex')
    if @workers[e]
      @workers[e].service = service
      @workers[e].auth = auth
      if not @services
        @services = []
      if not @services[service]
        @services[service] =
          waiting : []
          worker : 0
      if _.indexOf(@services[service].waiting,e) is -1
        @services[service].worker++
        @services[service].waiting.push(e)
      @emit 'connect',@workers[e]
    else
      logger.error 'worker doesn\'t exist'
    logger.debug(service + 'Registration')
    @SendWithEncrypt new messages.worker.AuthMessage(new Buffer(JSON.stringify(data)),envelope)
  else
    @SendWithEncrypt new messages.worker.AuthMessage('',envelope)
brokerServiceFunc = (workerlabel,d)->
  if @mapping[workerlabel]
    clientEnvelope = @mapping[workerlabel].envelope
    mapEnvelope = @mapping[workerlabel].mapping
    delete @mapping[workerlabel]
    @SendWithEncrypt new messages.client.ResponseMessage(null,d,clientEnvelope,mapEnvelope)
    logger.info("Broker to ",message.service.toString() , ' return')
module.exports =
  Broker   : Broker
