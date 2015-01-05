var http = require('http')
var argv = require('optimist').argv
var randomString = require('random-string')
var Pomelo = require('./pomelo-client')

var api = argv.a || argv.api || '127.0.0.1:13011'
var gate = argv.g || argv.gate || '127.0.0.1:13021'
var channel = argv.c || argv.channel || 'yang-hannah'
var num = argv.n || argv.num || 1

var apiHost = api.split(':')[0],
    apiPort = api.split(':')[1]
var gatHost = gate.split(':')[0],
    gatPort = gate.split(':')[1]

var createAudience = function(channel, userId) {
    applyToken(channel, userId, lookupConnector)
}

var applyToken = function(channel, userId, cb) {
    var req = http.request({
        hostname: apiHost,
        port: apiPort,
        method: 'POST'
    }, function(res){
        res.on('data', function(data) {
            body = JSON.parse(data.toString()).body
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

var lookupConnector = function(token) {
    console.log(token)
}

var audiences = []

for (var i=0; i<num; ++i) {
    audiences.push(createAudience(channel, randomString({length: 10}), i))
}
