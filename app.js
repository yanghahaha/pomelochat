var pomelo = require('pomelo')
var config = require('./app/util/config')
var blacklist = require('./app/util/blacklist')
var handlerLogFilter = require('./app/filters/handlerLogFilter')
var tokenService = require('./app/modules/token')
var channelService = require('./app/modules/channel')
var userService = require('./app/modules/user')
var leastConnDispatcher = require('./app/dispatchers/leastConnDispatcher')

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


var app = pomelo.createApp()
app.set('name', 'huomaotv-pomelochat')

config.init(app.get('env'), {path: './config/config.json'})
blacklist.init(app.get('env'), app.getServerType(), {path: './config/blacklist.json'})

app.configure(function(){
    app.rpcFilter(pomelo.rpcFilters.rpcLog())
    app.set('proxyConfig', {
        mailboxFactory: mailboxFactory
    })
    app.set('remoteConfig', {
        acceptorFactory: acceptorFactory
    })
    app.set('ssh_config_params', ['-P 1127'])
    app.enable('systemMonitor')
})

app.configure('all', 'connector', function(){
    app.set('connectorConfig', {
        connector : pomelo.connectors.hybridconnector,
        heartbeat : 30,
        distinctHost: true,
        firstTimeout: 3,
        disconnectOnTimeout: true,
        blacklistFun: blacklist.get
    })
    app.set('sessionConfig', {
        bindTimeout: 5
    })

    app.filter(handlerLogFilter(app, 'connector'))
})

app.configure('all', 'gate', function(){
	app.set('connectorConfig', {
		connector : pomelo.connectors.hybridconnector,
        distinctHost: true,
        firstTimeout: 3,
        disconnectOnTimeout: true,
        blacklistFun: blacklist.get
	})
    app.filter(handlerLogFilter(app, 'gate'))
    leastConnDispatcher.init(app)
})

app.configure('all', 'api', function(){
    app.set('connectorConfig', {
        connector : pomelo.connectors.httpconnector,
        distinctHost: true,
        blacklistFun: blacklist.get        
    })
    app.set('token', tokenService)
    app.set('user', userService)
    app.set('channel', channelService)
    app.filter(handlerLogFilter(app, 'api'))
    tokenService.init()
    channelService.init()
})

app.start()

process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack)
})
