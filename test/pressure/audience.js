var http = require('http')
var argv = require('optimist').argv
var randomString = require('random-string')
var Pomelo = require('./pomelo-client')

var api = argv.a || argv.api || '127.0.0.1:13011'
var gate = argv.g || argv.gate || '127.0.0.1:13021'
var channel = argv.c || argv.channel || 'yang-hannah'
var num = argv.n || argv.num || 100
var debug = argv.d || argv.debug || false
var leaveNum = argv.l || argv.leave || 10

var apiHost = api.split(':')[0],
    apiPort = api.split(':')[1]
var gateHost = gate.split(':')[0],
    gatePort = gate.split(':')[1]

var Audience = function(channel, userId) {
    this.channel = channel
    this.userId = userId
    this.pomelo = new Pomelo()

    if (!!debug) {
        this.pomelo.on('close', function(){
            console.log('close')
        })
        this.pomelo.setMessageProcessor(function(msg){
            console.log('%j', msg)
        }) 
    }    
}

Audience.prototype.init = function() {
    var self = this
    this.applyToken(function(token){
        self.token = token
        self.lookupConnector(self.connectConnector.bind(self))
    })
}

Audience.prototype.applyToken = function(cb) {
    var channel = this.channel,
        userId = this.userId

    var req = http.request({
        hostname: apiHost,
        port: apiPort,
        method: 'POST'
    }, function(res){
        res.on('data', function(data) {
            var body = JSON.parse(data.toString()).body
            if (body.code !== 0) {
                console.error('body.code = %s', body.code)
            }
            else {
                cb(body.token)
            }
        })
    })

    req.on('error', function(e) {
        console.error('problem with request: ' + e.message)
    })

    var reqBody = JSON.stringify({
        id: 1,
        route: 'api.apiHandler.applyToken',
        body: {
            userId: userId,
            channelId: channel,
            userData: {}
        }
    })

    req.write(reqBody)
    req.end()
}

Audience.prototype.lookupConnector = function(cb) {
    var self = this
    
    self.pomelo.connect({
        host: gateHost,
        port: gatePort
    }, function(){
        self.pomelo.request('gate.gateHandler.lookupConnector', {
            userId: self.userId,
            channelId: self.channel
        }, function(res) {
            self.pomelo.disconnect();
            if(res.code === 0) {
                cb(res.host, res.port)
            }
        })
    })
}

Audience.prototype.connectConnector = function(host, port) {
    var self = this

    if (!!debug) {
        self.pomelo.setMessageProcessor(function(msg){
            console.log('%j', msg)
        }) 
    }    

    self.pomelo.connect({
        host: host,
        port: port
    }, function(){
        // self.pomelo.request('api.apiHandler.sendChannelMsg', {
        //     channelId: 1,
        //     route: 'msg',
        //     msg: {}
        // }, function(res){
        //     console.log('%j', res)
        // })
        // return;
        self.pomelo.request("connector.connectorHandler.login", {
            userId: self.userId,
            channelId: self.channel,
            token: self.token
        }, function(res) {
            if (res.code === 0) {
                self.logined = true
                loginedCount++
                if (loginedCount === num) {
                    console.log('all %s audience connected', loginedCount)
                    setInterval(mock, 200)
                }
            }
        })
        //self.pomelo.disconnect()
    })
}

var mock = function() {
    for (var i=0; i<leaveNum; ++i) {
        var index = Math.random() * audiences.length | 0
        audiences[index].pomelo.disconnect()
        delete audiences[index]
        audiences[index] = createAudience(channel, randomString({length: 10}), index)
    }
}

var createAudience = function(channel, userId) {
    var audience = new Audience(channel, userId)
    audience.init()
    return audience
}

var audiences = []
var loginedCount = 0

for (var i=0; i<num; ++i) {
    audiences.push(createAudience(channel, randomString({length: 10}), i))
}
