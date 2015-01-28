var pomelo = require('pomelo')
var config = require('./app/util/config')
var blacklist = require('./app/util/blacklist')
var invalidPackageHandler = require('./app/util/invalidPackageHandler')
var handlerLogFilter = require('./app/filters/handlerLogFilter')
var tokenService = require('./app/modules/token')
var channelService = require('./app/modules/channel')
var frontChannelService = require('./app/modules/frontChannel')
var userService = require('./app/modules/user')
var leastConnDispatcher = require('./app/dispatchers/leastConnDispatcher')

var app = pomelo.createApp()
app.set('name', 'huomaotv-pomelochat')

config.init(app.get('env'), {path: './config/config.json'})
blacklist.init(app.get('env'), app.getServerType(), {path: './config/blacklist.json'})

app.configure(function(){
    app.set('proxyConfig', {
        bufferMsg: true,
        interval: 30
    })
    app.rpcFilter(pomelo.rpcFilters.rpcLog())
    app.set('ssh_config_params', ['-p 1127'])
})

app.configure('all', 'connector', function(){    
    app.set('connectorConfig', {
        connector : pomelo.connectors.hybridconnector,
        distinctHost: true,
        firstTimeout: 3,
        heartbeat : 30,
        disconnectOnTimeout: true,
        blacklistFun: blacklist.get,
        invalidPackageHandler: invalidPackageHandler
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
        blacklistFun: blacklist.get,
        invalidPackageHandler: invalidPackageHandler
	})
    app.set('sessionConfig', {
        bindTimeout: 5
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

app.configure('all', 'auth', function(){
    app.set('token', tokenService)
    tokenService.init()
    app.filter(handlerLogFilter(app, 'auth'))
})

app.configure('all', 'channel', function(){
    app.set('user', userService)
    app.set('channel', channelService)
    channelService.init()
    app.filter(handlerLogFilter(app, 'channel'))
})

app.start()

process.on('uncaughtException', function(err) {
	console.error(' Caught exception: ' + err.stack)
})
