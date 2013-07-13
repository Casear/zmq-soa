soa = require './index'
logger = require('./lib/logger').logger
t = new soa.Client('tcp://127.0.0.1:8008',{service:'賣肉'},(data,cb)->
  console.log( data )
  cb(data+" shit")
  

  )

setTimeout ()->
  t.send('賣肉',"holly",(err, data)->

    console.log(data)

    )

,3000
  