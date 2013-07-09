log4js = require 'log4js'

logger = log4js.getLogger()
if process.env.NODE_ENV is 'development'
  logger.setLevel('DEBUG')
else if process.env.NODE_ENV is 'production'
  logger.setLevel('INFO')

module.exports = 
  logger : logger