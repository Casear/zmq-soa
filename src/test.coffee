soa = require './index'
logger = require('./lib/logger').logger

s = new soa.Broker('tcp://*:8008',{})
t = new soa.Client('tcp://localhost:8008',{service:'1234'},(err,data)->
  logger.debug('get worker job')


  )
setTimeout(()->

  t.send('1234','test',(err,data)->
    logger.debug('get worker feedback.'+ (err || data) )


    )
,5000)