var http = require('http')
var argv = require('optimist').argv

var host = argv.h || argv.host || '127.0.0.1'
var port = argv.p || argv.port || 13011
var channel = argv.c || argv.channel || '"yang-hannah"'
var keys = argv.k || argv.key || '["name"]'

channel = JSON.parse(channel)
keys = JSON.parse(keys)

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
    route: 'api.apiHandler.getChannelUsers',
    body: {
        channelId: channel,
        dataKeys: keys
    }
})

console.log('req: ' + reqBody)
req.write(reqBody)

req.end()
