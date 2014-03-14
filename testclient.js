(function() {
  var logger, soa, t;

  soa = require('./index');

  logger = require('./lib/logger').logger;

  t = new soa.Client('127.0.0.1', '8008', {
    service: '賣肉'
  }, function(data, cb) {
    console.log(data);
    return cb(data + " shit");
  });

  t.on('connect', function() {
    return console.log('client connected');
  });

  t.on('disconnect', function() {
    return console.log('client disconnect');
  });

  t.on('ready', function() {
    console.log('client ready');
    return t.Authenticate('123');
  });

  t.on('authenticate', function() {
    return console.log('client authenticate');
  });

}).call(this);
