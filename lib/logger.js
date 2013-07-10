(function() {
  var log4js, logger;



  log4js = require('log4js');

  logger = log4js.getLogger();

  if (process.env.NODE_ENV === 'development') {
    logger.setLevel('DEBUG');
  } else if (process.env.NODE_ENV === 'production') {
    logger.setLevel('INFO');
  }

  module.exports = {
    logger: logger
  };

}).call(this);
