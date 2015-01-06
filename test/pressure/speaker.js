var http = require('http')
var argv = require('optimist').argv
var randomString = require('random-string')

var api = argv.a || argv.api || '127.0.0.1:13011'
var channel = argv.c || argv.channel || 'yang-hannah'
var room = argv.r || argv.room || 0
var num = argv.n || argv.num || 1
var interval = argv.i || argv.interval || 50
var speakLength = argv.l || argv.length || 30

var apiHost = api.split(':')[0],
    apiPort = api.split(':')[1]

var route
if (room === 0) {
    route = 'api.apiHandler.sendChannelMsg'
}
else {
    route = 'api.apiHandler.sendRoomMsg'
}

var speak = function() {
    var req = http.request({
        hostname: apiHost,
        port: apiPort,
        method: 'POST'
    }, function(res){
        res.on('data', function() {
        })
    })

    req.on('error', function(e) {
        console.log('problem with request: ' + e.message)
    })

    var reqBody = JSON.stringify({
        id: 1,
        route: route,
        body: {
            channelId: channel,
            roomId: room,
            route: 'msg',
            msg: {
                id: 1,
                name: randomString({length: 10}),
                conetent: randomString({length: speakLength})
            },
        }
    })
    req.write(reqBody)
    req.end()
}

setInterval(function(){
    for (var i=0; i<num; ++i) {
        speak()
    }
}, interval)
