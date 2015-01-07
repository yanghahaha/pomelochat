var pomelo = require('pomelo')
var config = require('./app/util/config')
var blacklist = require('./app/util/blacklist')
var handlerLogFilter = require('./app/filters/handlerLogFilter')
var tokenService = require('./app/modules/token')
var channelService = require('./app/modules/channel')
var frontChannelService = require('./app/modules/frontChannel')
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
    app.set('proxyConfig', {
        mailboxFactory: mailboxFactory
    })
    app.set('remoteConfig', {
        acceptorFactory: acceptorFactory
    })    
    app.rpcFilter(pomelo.rpcFilters.rpcLog())
    app.set('ssh_config_params', ['-p 1127'])
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
    app.set('pushSchedulerConfig', {
        scheduler: pomelo.pushSchedulers.buffer,
        flushInterval: 50
    })
    app.set('sessionConfig', {
        bindTimeout: 5
    })
    app.set('frontChannel', frontChannelService)


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
    leastConnDispatcher.init(app)
    app.filter(handlerLogFilter(app, 'gate'))    
})

app.configure('all', 'api', function(){
    app.set('connectorConfig', {
        connector : pomelo.connectors.httpconnector,
        distinctHost: true,
        blacklistFun: blacklist.get        
    })
    app.filter(handlerLogFilter(app, 'api'))
})

app.configure('all', 'channel', function(){
    app.set('token', tokenService)
    app.set('user', userService)
    app.set('channel', channelService)
    tokenService.init()
    channelService.init()
    app.filter(handlerLogFilter(app, 'channel'))
})

app.start()

process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack)
})
