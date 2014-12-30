var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('gate', __filename)
var config = require('../util/config')
var randomDispatcher = require('./randomDispatcher')

var app
var stats
var exp = module.exports

exp.init = function(application, stat) {
    app = application
    stats = stat
    if (!stats) {
        stats = {}
        _.each(app.getServersByType('connector'), function(server){
            stats[server.id] = 0
        })
    }
    startTimer()
}

exp.dispatch = function(servers) {
    var leastConnServer = null,
        leastConnCount = Number.MAX_VALUE
    _.each(servers, function(server) {
        if (stats[server.id] < leastConnCount) {
            leastConnServer = server
            leastConnCount = stats[server.id]
        }
    })

    if (!leastConnServer) {
        return randomDispatcher.dispatch(servers)
    }
    else {
        stats[leastConnServer.id]++
        return leastConnServer
    }
}

var startTimer = function() {
    var timeout = config.get('gate.lastConnDispatcherReloadSec') || 60
    setTimeout(reloadStats, timeout*1000)
}

var reloadStats = function() {
    stats = {}
    _.each(app.getServersByType('connector'), function(connector){
        stats[connector.id] = null
        app.rpc.connector.connectorRemote.getConnetionStat.toServer(connector.id, function(err, stat){
            if (!err) {
                stats[connector.id] = stat.totalConnCount
                logger.debug('reload connection count %s=%s', connector.id, stat.totalConnCount)
            }
        })
    })

    startTimer()
}
