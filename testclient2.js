(function() {
  var logger, soa, t;



  soa = require('./index');

  logger = require('./lib/logger').logger;

  t = new soa.Client('tcp://192.168.1.129:8008', {
    
  });

}).call(this);
