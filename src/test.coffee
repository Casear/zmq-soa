soa = require './index'
logger = require('./lib/logger').logger

s = new soa.Broker('tcp://*:8008',{})

setInterval(()->

  console.dir s.workers
  console.dir s.clients
  console.dir s.services
,5000)