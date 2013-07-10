(function() {
  var logger, s, soa;



  soa = require('./index');

  logger = require('./lib/logger').logger;

  s = new soa.Broker('tcp://*:8008', {});

  setInterval(function() {
    console.dir(s.workers);
    console.dir(s.clients);
    return console.dir(s.services);
  }, 5000);

}).call(this);
