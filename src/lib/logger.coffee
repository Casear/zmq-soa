log4js = require 'log4js'

logger = log4js.getLogger()
logger.setLevel('DEBUG')
if process.env.NODE_ENV is 'production'
  logger.setLevel('INFO')

module.exports =
  logger : logger
