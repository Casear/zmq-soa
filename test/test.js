(function() {
  var async, broker, client, logger, net, port, soa, worker, worker2, worker3, worker4, worker5, worker6;



  soa = require('../index');

  logger = require('../lib/logger').logger;

  async = require('async');

  net = require('net');

  require('should');

  broker = null;

  worker = null;

  worker2 = null;

  worker3 = null;

  worker4 = null;

  worker5 = null;

  worker6 = null;

  client = null;

  port = 8008;

  describe('Initial', function() {
    this.timeout(10000);
    describe('broker start', function() {
      return it('should create broker and test the connection', function(done) {
        var conn, finish;
        broker = new soa.Broker('tcp://*:' + port, {});
        broker.on('auth', function(envelope, data, cb) {
          logger.info('auth ' + data.auth);
          if (data.auth && data.auth === '123') {
            if (cb) {
              if (data.service) {
                return cb(true, envelope, data.service, data);
              } else {
                return cb(true, envelope, data);
              }
            } else {
              return cb(false, envelope);
            }
          } else {
            return cb(false, envelope);
          }
        });
        finish = false;
        conn = net.Socket();
        conn.connect(port, '127.0.0.1', function() {
          var finsih;
          conn.destroy();
          if (!finish) {
            finsih = true;
            return done();
          }
        });
        return conn.setTimeout(2000, function() {
          if (!finish) {
            finish = true;
            conn.destroy();
            throw new Error('connection failed');
          }
        });
      });
    });
    describe('woker start', function() {
      return it('should create woker and test to connect the broker', function(done) {
        worker = new soa.Client('localhost', port, {
          service: 'test'
        }, function(data, cb) {
          logger.debug('get test message');
          return cb(data);
        });
        worker.on('connect', function() {
          return logger.debug('woker connected');
        });
        worker.on('ready', function() {
          logger.debug('worker ready');
          return worker.Authenticate('123');
        });
        return worker.on('authenticate', function(result) {
          result.should.equal(true);
          return done();
        });
      });
    });
    describe('woker auth failed', function() {
      return it('should create woker and test to connect the broker and auth is working', function(done) {
        worker = new soa.Client('localhost', port, {
          service: 'test'
        }, function(data, cb) {
          logger.debug('get test message');
          return cb(data);
        });
        worker.on('connect', function() {
          return logger.debug('woker connected');
        });
        worker.on('ready', function() {
          logger.debug('worker ready');
          return worker.Authenticate('5678');
        });
        return worker.on('authenticate', function(result) {
          result.should.equal(false);
          broker.services['test'].worker.should.equal(1);
          return done();
        });
      });
    });
    return describe('client start', function() {
      it('should create client and test to connect the broker', function(done) {
        client = new soa.Client('localhost', port, {});
        client.on('connect', function() {
          return logger.debug('client connected');
        });
        client.on('ready', function() {
          logger.debug('client ready');
          return client.Authenticate('123');
        });
        return client.on('authenticate', function(result) {
          result.should.equal(true);
          broker.services['test'].worker.should.equal(1);
          return done();
        });
      });
      return it('should create client and test to connect the broker and auth is working', function(done) {
        var client2;
        client2 = new soa.Client('localhost', port, {});
        client2.on('connect', function() {
          return logger.debug('client connected');
        });
        client2.on('ready', function() {
          logger.debug('client failed ready');
          return client2.Authenticate('5678');
        });
        return client2.on('authenticate', function(result) {
          result.should.equal(false);
          return done();
        });
      });
    });
  });

  describe('Messaging', function() {
    this.timeout(15000);
    return describe('worker get messages', function() {
      it('should get message from client', function(done) {
        worker2 = new soa.Client('localhost', port, {
          service: 'test2'
        }, function(data, cb) {
          logger.debug('get test2 message');
          data.toString().should.equal('message');
          return cb(data);
        });
        worker2.on('connect', function() {
          return logger.debug('woker4 connected');
        });
        worker2.on('ready', function() {
          logger.debug('worker4 ready');
          return worker2.Authenticate('123');
        });
        return worker2.on('authenticate', function(result) {
          result.should.equal(true);
          broker.services['test2'].worker.should.equal(1);
          return client.send('test2', new Buffer('message'), function(err, data) {
            logger.debug('test2 client back');
            if (err) {
              logger.error(err);
              throw err;
            } else {
              data.toString().should.equal('message');
            }
            return done();
          });
        });
      });
      it('should get message from client without response', function(done) {
        worker3 = new soa.Client('localhost', port, {
          service: 'test3'
        }, function(data, cb) {
          logger.info('get test3 message');
          data.toString().should.equal('message');
          logger.info('send back from test3');
          cb(data);
          return done();
        });
        worker3.on('connect', function() {
          return logger.debug('woker4 connected');
        });
        worker3.on('ready', function() {
          logger.debug('worker4 ready');
          return worker3.Authenticate('123');
        });
        return worker3.on('authenticate', function(result) {
          result.should.equal(true);
          logger.info('send test3 message');
          broker.services['test3'].worker.should.equal(1);
          return client.send('test3', new Buffer('message'), function() {
            return logger.info('back ');
          });
        });
      });
      return it('should get message from client and other worker', function(done) {
        worker4 = new soa.Client('localhost', port, {
          service: 'test4'
        }, function(data, cb) {
          logger.debug('get test4 message');
          data.toString().should.equal('message');
          return worker4.send('test', data, function(err, data) {
            logger.debug('get test message');
            if (err) {
              throw err;
            }
            data.toString().should.equal('message');
            return cb(data);
          });
        });
        worker4.on('connect', function() {
          return logger.debug('woker4 connected');
        });
        worker4.on('ready', function() {
          logger.debug('worker4 ready');
          return worker4.Authenticate('123');
        });
        return worker4.on('authenticate', function(result) {
          result.should.equal(true);
          broker.services['test4'].worker.should.equal(1);
          return client.send('test4', new Buffer('message'), function(err, data) {
            logger.debug('test4 client back');
            if (err) {
              throw err;
            }
            data.toString().should.equal('message');
            return done();
          });
        });
      });
    });
  });

  describe('Pub', function() {
    this.timeout(20000);
    return describe('Broker Send Msg ', function() {
      return it('should get message from broker', function(done) {
        return async.parallel([
          function(callback) {
            worker5 = new soa.Client('localhost', port, {
              service: 'ppp'
            }, function(data, cb) {
              logger.debug('get pub message');
              data.toString().should.equal('pub message');
              return callback(null);
            });
            worker5.on('connect', function() {
              return logger.debug('woker5 connected');
            });
            worker5.on('ready', function() {
              logger.debug('worker5 ready');
              return this.Authenticate('123');
            });
            return worker5.on('authenticate', function(result) {
              logger.info('worker5 successful');
              return result.should.equal(true);
            });
          }, function(callback) {
            worker6 = new soa.Client('localhost', port, {
              service: 'ppp'
            }, function(data, cb) {
              logger.debug('get pub message');
              data.toString().should.equal('pub message');
              return callback(null);
            });
            worker6.on('connect', function() {
              return logger.debug('woker6 connected');
            });
            worker6.on('ready', function() {
              logger.debug('worker6 ready');
              return this.Authenticate('123');
            });
            return worker6.on('authenticate', function(result) {
              result.should.equal(true);
              return logger.info('worker6 successful');
            });
          }, function(callback) {
            return setTimeout(function() {
              broker.Pub("ppp", "pub message");
              return callback(null);
            }, 6000);
          }
        ], function(err, result) {
          return done();
        });
      });
    });
  });


  /*
  
  
  client = new soa.Client('tcp://localhost:8008',{service:'1234'},(err,data)->
    logger.debug('get worker job')
  
  
    )
  setTimeout(()->
  
    t.send('1234','test',(err,data)->
      logger.debug('get worker feedback.'+ (err || data) )
  
  
      )
  ,5000)
  describe('Array', function(){
    describe('#indexOf()', function(){
      it('should return -1 when the value is not present', function(){
        assert.equal(-1, [1,2,3].indexOf(5));
        assert.equal(-1, [1,2,3].indexOf(0));
      })
    })
  })
  */

}).call(this);
