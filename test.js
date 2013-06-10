(function() {
  var logger, s, soa, t;

  soa = require('./index');

  logger = require('./lib/logger').logger;

  s = new soa.Broker('tcp://*:8008', {});

  t = new soa.Client('tcp://localhost:8008', {
    service: '1234'
  }, function(err, data) {
    return logger.debug('get worker job');
  });

  setTimeout(function() {
    return t.send('1234', 'test', function(err, data) {
      return logger.debug('get worker feedback.' + (err || data));
    });
  }, 5000);

}).call(this);
