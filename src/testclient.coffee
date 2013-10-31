soa = require './index'
logger = require('./lib/logger').logger
t = new soa.Client('127.0.0.1','8008',{service:'賣肉'},(data,cb)->
  console.log( data )
  cb(data+" shit")
  

  )

