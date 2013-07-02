soa = require './index'
logger = require('./lib/logger').logger
t = new soa.Client('tcp://106.186.16.33:8008',{service:'1234'},(err,data)->
  logger.debug('get worker job')


  )