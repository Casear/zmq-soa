zmq-soa
=======

implement distributed zmq SOA broker , worker , requester

## Usage
`npm install zmq-soa`

## Broker

### Start broker

Broker is used for setting

```js
    soa = require('zmq-soa');
    var port = 8888
    var broker = new soa.Broker('tcp://*:'+port, {});
```

### Detect client connect  event

```js
broker.on('connect', function(client) {
    console.log('connect')
})
    
```

### Detect client disconnect  event

```js
broker.on('disconnect', function(client) {
    console.log('connect')
})
    
```
## Worker and client

### Start to connect
```js
var port = 8888

//worker connect
worker = new soa.Client('localhost', port, 
    {
        service: 'serviceName'
    }
    , 
    //worker response function
    function(data, cb) {
        console.log('get test message'+data);
        return cb(data);
    }
);
//client connect
client = new soa.Client('localhost', 8888);
```

### Connected Event
```js
worker.on('connect', function() {
    console.log('woker connected');
});
```


##Authenticate


### worker auth
```js
//trigger after encryption handshake
worker.on('ready', function() { 
    worker.Authenticate('123');
});

//auth to broker
worker.on('authenticate', function(result) {
    if(result)
        console.log('auth success')
    else
        console.log('auth failed')
});
```


### broker auth event
####broker.on('auth', function(envelope, data, cb))
```js
broker.on('auth', function(envelope, data, cb) {
    // check user information
    if (data.auth && data.auth === 'password') {
        if (cb) {
            
            if (data.service) {
                //auth success and set client as a worker
                return cb(true, envelope, data.service, data);
            } else {
                //auth success and set client as a worker
                return cb(true, envelope, data);
            }
        } 
    } else {
        //auth failed
        return cb(false, envelope);
    }
});
```


### Client 

```
client = new soa.Client('localhost', port);
client.send('test2', new Buffer('message'), function(err, data) {})
```
### Worker send for other service
```
worker = new soa.Client('localhost', port, 
    {
        service: 'serviceName'
    }
    , 
    //worker response function
    function(data, cb) {
        console.log('get test message'+data);
        worker.send('service2',function(data){
            return cb(data);
        })
    }
);
```



### Broker service 
Broker service provide client and worker to get message from broker directly.
####broker.on('service',function(msg,client-envelop,[callback])

```js
broker.on('service', function(msg, envelope, cb) {
    console.log(msg.data.toString())
    cb(
});
```
####client.sendBService(data,[callback],[timeout])
```js
client.sendBService(new Buffer("{'data':'123'}"));
client.sendBService(new Buffer("{'data':'123'}")
    ,
    //service return data
    function(error,data){
        console.log(data.toString())
    }
    //10 second
    ,10
);
```




## License
MIT
