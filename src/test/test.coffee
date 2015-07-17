soa = require '../index'
logger = require('../lib/logger').logger
async = require('async')
net = require 'net'
require 'should'
broker = null
worker = null
worker2 = null
worker3 = null
worker4 = null
worker5 = null
worker6 = null
client = null
port = 8008
describe 'Initial',()->
  @timeout(10000)
  describe 'broker start',()->
    it('should create broker and test the connection',(done)->
      broker = new soa.Broker('tcp://*:'+port,{})
      broker.on('auth',(envelope,data,cb)->
        logger.info('auth '+data.auth)
        if data.auth and data.auth is '123'
          if cb
            if data.service
              cb true,envelope,data.service,data,data.auth
            else
              cb true,envelope,data,data.auth
          else
            cb false,envelope
        else
          cb false,envelope
      )
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
        cb(data,false)
      )
      worker.on 'connect',()->
        logger.debug('woker connected')
      worker.on 'ready',()->
        logger.debug('worker ready')
        worker.Authenticate('123')
      worker.on 'authenticate',(result)->
        result.should.equal(true)
        done()
    )
  describe 'woker auth failed',()->
    it('should create woker and test to connect the broker and auth is working',(done)->
      worker = new soa.Client('localhost',port,{service:'test'},(data,cb)->
        logger.debug('get test message')
        cb(data,false)
      )
      worker.on 'connect',()->
        logger.debug('woker connected')
      worker.on 'ready',()->
        logger.debug('worker ready')
        worker.Authenticate('5678')
      worker.on 'authenticate',(result)->
        result.should.equal(false)
        broker.services['test'].worker.should.equal(1)
        done()
    )
  describe 'client start',()->
    it('should create client and test to connect the broker',(done)->
      client = new soa.Client('localhost',port,{})
      client.on 'connect',()->
        logger.debug('client connected')
      client.on 'ready',()->
        logger.debug('client ready')
        client.Authenticate('123')
      client.on 'authenticate',(result)->
        result.should.equal(true)
        broker.services['test'].worker.should.equal(1)
        done()
    )
    it('should create client and test to connect the broker and auth is working',(done)->
      client2 = new soa.Client('localhost',port,{})
      client2.on 'connect',()->
        logger.debug('client connected')
      client2.on 'ready',()->
        logger.debug('client failed ready')
        client2.Authenticate('5678')
      client2.on 'authenticate',(result)->
        result.should.equal(false)
        done()
    )
describe 'Messaging',()->
  @timeout(15000)
  describe 'worker get messages',()->
    it('should get message from client',(done)->
      worker2 = new soa.Client('localhost',port,{service:'test2'},(data,cb)->
        logger.debug('get test2 message')
        data.toString().should.equal('message')
        cb(data,false)
        )
      worker2.on 'connect',()->
        logger.debug('woker4 connected')
      worker2.on 'ready',()->
        logger.debug('worker4 ready')
        worker2.Authenticate('123')
      worker2.on 'authenticate',(result)->
        result.should.equal(true)
        broker.services['test2'].worker.should.equal(1)
        client.send('test2',new Buffer('message'),false,(err,data)->
          logger.debug('test2 client back')
          if err
            logger.error err
            throw err
          else
            data.toString().should.equal('message')
          done()
          )
    )
    it('should get message from client without response',(done)->
      worker3 = new soa.Client('localhost',port,{service:'test3'},(data,cb)->
        logger.info('get test3 message')
        data.toString().should.equal('message')
        logger.info('send back from test3')
        cb(data,false)
        done()
      )
      worker3.on 'connect',()->
        logger.debug('woker4 connected')
      worker3.on 'ready',()->
        logger.debug('worker4 ready')
        worker3.Authenticate('123')
      worker3.on 'authenticate',(result)->
        result.should.equal(true)
        logger.info('send test3 message')
        broker.services['test3'].worker.should.equal(1)

        client.send('test3',new Buffer('message'),false,()->
          logger.info('back ')
        )
    )
    it('should get message from client and other worker',(done)->
      worker4 = new soa.Client('localhost',port,{service:'test4'},(data,cb)->
        logger.debug('get test4 message')
        data.toString().should.equal('message')
        worker4.send('test',data,false,(err,data)->
          logger.debug('get test message')
          if err
            throw err
          data.toString().should.equal('message')
          cb(data,false)
          )
        )
      worker4.on 'connect',()->
        logger.debug('woker4 connected')
      worker4.on 'ready',()->
        logger.debug('worker4 ready')
        worker4.Authenticate('123')
      worker4.on 'authenticate',(result)->
        result.should.equal(true)
        broker.services['test4'].worker.should.equal(1)
        client.send('test4',new Buffer('message'),false,(err,data)->
          logger.debug('test4 client back')
          if err
            throw err
          data.toString().should.equal('message')
          done()
          )
    )

describe 'Pub',()->
  @timeout(20000)
  describe 'Broker Send Msg ',()->
    it('should get message from broker',(done)->
      async.parallel([
        (callback)->
          worker5 = new soa.Client('localhost',port,{service:'ppp'},(data,cb)->
            logger.debug('get pub message')
            data.toString().should.equal('pub message')
            callback(null)
            )
          worker5.on 'connect',()->
            logger.debug('woker5 connected')
          worker5.on 'ready',()->
            logger.debug('worker5 ready')
            @Authenticate('123')
          worker5.on 'authenticate',(result)->
            logger.info('worker5 successful')
            result.should.equal(true)
        (callback)->
          worker6 = new soa.Client('localhost',port,{service:'ppp'},(data,cb)->
            logger.debug('get pub message')
            data.toString().should.equal('pub message')
            callback(null)
            )
          worker6.on 'connect',()->
            logger.debug('woker6 connected')
          worker6.on 'ready',()->
            logger.debug('worker6 ready')
            @Authenticate('123')
          worker6.on 'authenticate',(result)->
            result.should.equal(true)
            logger.info('worker6 successful')
        (callback)->
          setTimeout ()->
            broker.Pub("ppp","pub message")
            callback(null)
          ,6000
      ], (err, result)->
        done()
      )
    )
describe 'Service',()->
  @timeout(20000)
  describe 'Broker Add Service Msg ',()->
    it('should get message from broker',(done)->
      broker.on('service',(workerlabel,msg,cb)->
        msg.data.toString().should.equal("{'service':'213'}")
        done()
      )
      worker4.sendBService(new Buffer("{'service':'213'}"))
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
