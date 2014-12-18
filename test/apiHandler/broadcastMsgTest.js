var http = require('http')
var argv = require('optimist').argv

var host = argv.h || argv.host || '127.0.0.1'
var port = argv.p || argv.port || 13011

var req = http.request({
    hostname: host,
    port: port,
    method: 'POST'
}, function(res){
    res.on('data', function(body) {
        console.log('req: ' + body);
    })
})

req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
})

var reqBody = JSON.stringif({
    id: 1,
    route: 'api.apiHandler.broadcastMsg',
    body: {
        route: 'msg',
        msg: {
            id: 111,
            name: 'bob',
            conetent: 'hello world'
        },
    }
})

req.write(reqBody)
console.log('res: ' + reqBody)
req.end()
