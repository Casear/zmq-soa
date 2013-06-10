log4js = require 'log4js'

logger = log4js.getLogger()

logger.setLevel('DEBUG')

module.exports = 
  logger : logger