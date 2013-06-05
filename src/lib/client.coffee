zmq = require 'zmq'
message = require './message'
class Client
  
  
  constructor:()->
    @_isConnect = false
    @done = false
    @service = ''
    @defaultTimeout = 5000
    l = arguments.length
    if l >3 or l < 1
      @socket = zmq.socket('dealer')
      @socket.connect arguments[0]
      @socket.on 'message',@.onMsg.bind(@)
      if l is 2
        if arguments[1] and getClass.call(arguments[1]) is '[object Function]'
          @workerCallback = arguments[1]
        else
          options = arguments[1]
      else if l is 3
        options = arguments[1]
        if arguments[2] and getClass.call(arguments[2]) is '[object Function]'
          @workerCallback = arguments[2]
      if options.service
        @service = options.service
      if options.timeout
        defaultTimeout = options.timeout
      @ready()
    
      
    
  onMsg:()->
    msg = message.fromFrames(arguments)
    if msg instanceof message.client.ResponseMessage
      @onClientMessage(msg)
    else if message instanceof messages.worker.RequestMessage
      @onWorkerMessage(msg)
    else if message instanceof messages.worker.DisconnectMessage
      @onDisconnect(message);
    else if message instanceof messages.worker.DisconnectMessage
      @onHeartbeat(message);
    else
      console.log('invalid request')
  
  onDisconnect:()->
    console.log('received disconnect request')
    @socket.disconnect(@socket.last_endpoint)
    @connected = false
  
  onClientMessage:(msg)->
    clearTimeout(@timeout)
    @done = true
    @callback(null, JSON.parse(msg.data))
  onWorkerMessage:(msg)->
    #@workerCallback msg,((returnMsg)->@socket.send(new message.WorkerRequestMessage(msg.service,JSON.stringify(returnMsg)).toFrames()).bind(@)
  ready:()->
    unless @connected
      @socket.send(new message.worker.ReadyMessage(@service).toFrames())
      @connected = true;
    else
      console.log('worker is already connected to the broker'); 
  send:(service,msg,@callback,timeout)->
    if !@connected
      @socket.send(new message.client.RequestMessage(service, JSON.stringify(data)).toFrames());
      @timeout = setTimeout((()->
        unless @done
          @callback(new Error('timeout'))
        
        delete @callback;
      ).bind(@), timeout or defaultTimeout)

modules.export = 
  Client : Client