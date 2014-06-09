(function() {
  var log4js, logger;

  log4js = require('log4js');

  log4js.configure({
    appenders: [
      {
        "level": "info",
        "type": "dateFile",
        "filename": "info.log",
        "pattern": "-yyyy-MM-dd",
        "alwaysIncludePattern": false
      }, {
        "level": "error",
        "type": "dateFile",
        "filename": "error.log",
        "pattern": "-yyyy-MM-dd",
        "maxLogSize": 20480,
        "alwaysIncludePattern": false
      }
    ]
  });

  logger = log4js.getLogger();

  logger.setLevel('DEBUG');

  if (process.env.NODE_ENV === 'production') {
    logger.setLevel('INFO');
  }

  module.exports = {
    logger: logger
  };

}).call(this);
