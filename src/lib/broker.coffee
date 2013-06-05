redis = require 'redis'
zmq = require 'zmq'
message = require './message'
class Broker extends EventEmitter
  
  constructor:(endpoint,options)->
    @service = {}
    @workers = 0
    @queue = []  
    @socket = zmq.socket('router')
    @socket.bindSync(endpoint)
    @socket.on('message', @onMessage.bind(@));

  onMessage:()->
    message = messages.fromFrames(arguments, true)
    if(message instanceof messages.client.Message)
      if(message instanceof messages.client.RequestMessage)
        @onClientRequest(message);
    else if(message instanceof messages.worker.Message)
      if message instanceof messages.worker.ReadyMessage
        @onWorkerReady(message, envelope)
      else if message instanceof messages.worker.DisconnectMessage
        @onWorkerDisconnect(message);
    
  

  onWorkerReady:(message, envelope)->
    if @service.hasOwnProperty(message.service)
      
  onWorkerDisconnect:()->


  disconnectWorker:(envelope)->
    @socket.send(new messages.worker.DisconnectMessage(envelope).toFrames())
  disconnect:()->

