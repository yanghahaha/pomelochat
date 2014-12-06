var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var exp = module.exports

var app

exp.init = function(pomeloApp) {
    app = pomeloApp
}

exp.add = function(identifier, context) {
    getChannel(identifier).add(identifier, context.channelUid, context.frontServerId)
    logger.debug('pomelo.channelService.add(%s, %s, %s)', identifier, context.channelUid, context.frontServerId)
}

var getChannel = function(identifier) {
    return app.get('channelService').getChannel(identifier, true)
}