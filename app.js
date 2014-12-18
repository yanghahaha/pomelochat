var pomelo = require('pomelo')

var app = pomelo.createApp()
app.set('name', 'huomaotv-pomelochat')

var handlerLogFilter = require('./app/filters/handlerLogFilter')
var tokenService = require('./app/modules/token')

var TcpMailBox = require('pomelo-rpc').client.TcpMailbox
var TcpAcceptor = require('pomelo-rpc').server.TcpAcceptor

var mailboxFactory = {
    create: function(serverInfo, opts) {
        return TcpMailBox.create(serverInfo, opts)
    }
}

var acceptorFactory = {
    create: function(opts, cb) {
        return TcpAcceptor.create(opts, cb)
    }
}

app.configure('production|development', function(){
    app.rpcFilter(pomelo.rpcFilters.rpcLog())
    app.set('proxyConfig', {
        mailboxFactory: mailboxFactory
    })
    app.set('remoteConfig', {
        acceptorFactory: acceptorFactory
    })
    app.set('ssh_config_params', ['-P 1127'])
})

app.configure('production|development', 'connector', function(){
    app.set('connectorConfig', {
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
        distinctHost: true,
        firstTimeout: 3,
        disconnectOnTimeout: true
    })

    app.filter(handlerLogFilter(app, 'connector'))
})

app.configure('production|development', 'gate', function(){
	app.set('connectorConfig', {
		connector : pomelo.connectors.hybridconnector,
        distinctHost: true,
        firstTimeout: 3,
        disconnectOnTimeout: true
	})

    app.filter(handlerLogFilter(app, 'gate'))
})

app.configure('production|development', 'api', function(){
    app.set('connectorConfig', {
        connector : pomelo.connectors.httpconnector,
        distinctHost: true
    })
    app.filter(handlerLogFilter(app, 'api'))
    tokenService.init()
})

app.start()

process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack)
})
