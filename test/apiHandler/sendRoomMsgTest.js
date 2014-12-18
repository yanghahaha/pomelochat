var http = require('http')
var argv = require('optimist').argv

var host = argv.h || argv.host || '127.0.0.1'
var port = argv.p || argv.port || 13011
var channel = argv.c || argv.channel || 'yang-hannah'
var room = argv.r || argv.room || 1

var req = http.request({
    hostname: host,
    port: port,
    method: 'POST'
}, function(res){
    res.on('data', function(body) {
        console.log('res: ' + body);
    })
})

req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
})

var reqBody = JSON.stringify({
    id: 1,
    route: 'api.apiHandler.sendRoomMsg',
    body: {
        channelId: channel,
        roomId: room,
        route: 'msg',
        msg: {
            id: 111,
            name: 'bob',
            conetent: 'hello room'
        },
    }
})
console.log('res: ' + reqBody)
req.write(reqBody)

req.end()
