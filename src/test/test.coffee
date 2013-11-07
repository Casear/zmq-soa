soa = require '../index'
logger = require('../lib/logger').logger
console.log(logger)
net = require 'net'
require 'should'
broker = null
worker = null
worker2 = null
worker3 = null
worker4 = null
client = null
port = 8008
describe 'Initial',()->
  @timeout(10000)
  describe 'broker start',()->
    it('should create broker and test the connection',(done)-> 
      broker = new soa.Broker('tcp://*:'+port,{})
      finish = false
      conn = net.Socket()
      conn.connect(port,'127.0.0.1',()->
        conn.destroy()
        unless finish 
          finsih = true
          done()
      )
      conn.setTimeout(2000, ()->
        unless finish 
          finish  = true
          conn.destroy()
          throw new Error('connection failed')
        )
    )

  describe 'woker start',()->
    it('should create woker and test to connect the broker',(done)->
      worker = new soa.Client('localhost',port,{service:'test'},(data,cb)->
        logger.debug('get test message')
        cb(data)
      )
      worker.on 'connect',()->
        logger.debug('woker connected')
      worker.on 'ready',()->
        logger.debug('worker ready')
        worker.Authenticate('123')
      worker.on 'ready',()->
        logger.debug('woker connected')
      setTimeout(()->
        logger.error broker.services
        broker.services['test'].worker.should.equal(1)
        done()
      ,1000)
    )

  describe 'client start',()->
    it('should create client and test to connect the broker',(done)->
      client = new soa.Client('localhost',port,{})
      client.on 'connect',()->
        logger.debug('client connected')
      client.on 'ready',()->
        logger.debug('client ready')
        client.Authenticate('123')
      client.on 'ready',()->
        logger.debug('client connected')
      setTimeout(()->
        broker.services['test'].worker.should.equal(1)
        done()
      ,1000)
    )

describe 'Messaging',()->
  @timeout(10000)
  describe 'worker get messages',()->
    it('should get message from client',(done)->
      worker2 = new soa.Client('localhost',port,{service:'test2'},(data,cb)->
        logger.debug('get test2 message')
        data.toString().should.equal('message')  
        cb(data)
        )
      worker2.on 'connect',()->
        logger.debug('woker4 connected')
      worker2.on 'ready',()->
        logger.debug('worker4 ready')
        worker2.Authenticate('123')
      worker2.on 'ready',()->
        logger.debug('woker4 connected')
      setTimeout(()->
        broker.services['test2'].worker.should.equal(1)
        client.send('test2','message',(err,data)->
          logger.debug('test2 client back')
          if err
            throw err
          else
            logger.error(data.toString())
            data.toString().should.equal('message')
          done()
          )
        
      ,3000)
    )

    it('should get message from client without response',(done)->
      worker3 = new soa.Client('localhost',port,{service:'test3'},(data,cb)->
        logger.info('get test3 message')
        data.toString().should.equal('message')  
        logger.info('send back from test3')
        cb(data)

       
        done()
       
      )
      worker3.on 'connect',()->
        logger.debug('woker4 connected')
      worker3.on 'ready',()->
        logger.debug('worker4 ready')
        worker3.Authenticate('123')
      worker3.on 'ready',()->
        logger.debug('woker4 connected')
      setTimeout(()->
        logger.info('send test3 message')
        broker.services['test3'].worker.should.equal(1)
        client.send('test3','message',()->
          logger.info('back ')
        )
        
      ,3000)
    )

    it('should get message from client and other worker',(done)->
      worker4 = new soa.Client('localhost',port,{service:'test4'},(data,cb)->
        logger.debug('get test4 message')
        data.toString().should.equal('message')  
        worker4.send('test',data,(err,data)->
          logger.debug('get test message')
          if err 
            throw err
          data.toString().should.equal('message')
          cb(data)
          )
        
        )
      worker4.on 'connect',()->
        logger.debug('woker4 connected')
      worker4.on 'ready',()->
        logger.debug('worker4 ready')
        worker4.Authenticate('123')
      worker4.on 'ready',()->
        logger.debug('woker4 connected')

      setTimeout(()->
        broker.services['test4'].worker.should.equal(1)
        client.send('test4','message',(err,data)->
          logger.debug('test4 client back')
          if err
            throw err
          data.toString().should.equal('message')
          done()
          )
        
      ,3000)
    )    


###


client = new soa.Client('tcp://localhost:8008',{service:'1234'},(err,data)->
  logger.debug('get worker job')


  )
setTimeout(()->

  t.send('1234','test',(err,data)->
    logger.debug('get worker feedback.'+ (err || data) )


    )
,5000)
describe('Array', function(){
  describe('#indexOf()', function(){
    it('should return -1 when the value is not present', function(){
      assert.equal(-1, [1,2,3].indexOf(5));
      assert.equal(-1, [1,2,3].indexOf(0));
    })
  })
})
###
