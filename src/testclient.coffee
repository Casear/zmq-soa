soa = require './index'
logger = require('./lib/logger').logger
t = new soa.Client('127.0.0.1','8008',{service:'賣肉'},(data,cb)->
  console.log( data )
  cb(data+" shit")
  

  )

t.on('connect',()->

    console.log('client connected')
)

t.on('disconnect',()->

    console.log('client disconnect')
)

t.on('ready',()->

    console.log('client ready')
    t.Authenticate('123')
)
t.on('authenticate',()->

    console.log('client authenticate')
)
