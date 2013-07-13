(function() {
  var logger, soa, t;



  soa = require('./index');

  logger = require('./lib/logger').logger;

  t = new soa.Client('tcp://127.0.0.1:8008', {
    service: '賣肉'
  }, function(data, cb) {
    console.log(data);
    return cb(data + " shit");
  });

  setTimeout(function() {
    return t.send('賣肉', "holly", function(err, data) {
      return console.log(data);
    });
  }, 3000);

}).call(this);
