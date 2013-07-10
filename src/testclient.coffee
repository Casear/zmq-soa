soa = require './index'
logger = require('./lib/logger').logger
t = new soa.Client('tcp://192.168.1.129:8008',{service:'1234'},(err,data)->
  logger.debug('get worker job')


  )