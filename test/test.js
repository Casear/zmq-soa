(function() {
  var broker, client, logger, net, port, soa, worker, worker2, worker3, worker4;



  soa = require('../index');

  logger = require('../lib/logger').logger;

  console.log(logger);

  net = require('net');

  require('should');

  broker = null;

  worker = null;

  worker2 = null;

  worker3 = null;

  worker4 = null;

  client = null;

  port = 8008;

  describe('Initial', function() {
    this.timeout(10000);
    describe('broker start', function() {
      return it('should create broker and test the connection', function(done) {
        var conn, finish;
        broker = new soa.Broker('tcp://*:' + port, {});
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
        worker = new soa.Client('tcp://localhost:' + port, {
          service: 'test'
        }, function(data, cb) {
          logger.debug('get test message');
          return cb(data);
        });
        return setTimeout(function() {
          broker.services['test'].worker.should.equal(1);
          return done();
        }, 1000);
      });
    });
    return describe('client start', function() {
      return it('should create client and test to connect the broker', function(done) {
        client = new soa.Client('tcp://localhost:' + port, {});
        return setTimeout(function() {
          broker.services['test'].worker.should.equal(1);
          return done();
        }, 1000);
      });
    });
  });

  describe('Messaging', function() {
    this.timeout(10000);
    return describe('worker get messages', function() {
      it('should get message from client', function(done) {
        worker2 = new soa.Client('tcp://localhost:' + port, {
          service: 'test2'
        }, function(data, cb) {
          logger.debug('get test2 message');
          data.toString().should.equal('message');
          return cb(data);
        });
        return setTimeout(function() {
          broker.services['test2'].worker.should.equal(1);
          return client.send('test2', 'message', function(err, data) {
            logger.debug('test2 client back');
            if (err) {
              throw err;
            } else {
              logger.error(data.toString());
              data.toString().should.equal('message');
            }
            return done();
          });
        }, 3000);
      });
      it('should get message from client without response', function(done) {
        worker3 = new soa.Client('tcp://localhost:' + port, {
          service: 'test3'
        }, function(data, cb) {
          logger.debug('get test3 message');
          data.toString().should.equal('message');
          cb(data);
          return done();
        });
        return setTimeout(function() {
          broker.services['test3'].worker.should.equal(1);
          return client.send('test3', 'message');
        }, 3000);
      });
      return it('should get message from client and other worker', function(done) {
        worker4 = new soa.Client('tcp://localhost:' + port, {
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
        return setTimeout(function() {
          broker.services['test4'].worker.should.equal(1);
          return client.send('test4', 'message', function(err, data) {
            logger.debug('test4 client back');
            if (err) {
              throw err;
            }
            data.toString().should.equal('message');
            return done();
          });
        }, 3000);
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
