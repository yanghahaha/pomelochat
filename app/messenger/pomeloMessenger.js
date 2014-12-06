var util = require('util')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var app, exp = module.exports

exp.init = function(pomeloApp) {
    app = pomeloApp
}

exp.add = function(identifier, context) {
    var channel = getChannel(identifier)
    channel.add(context.channelUid, context.frontServerId)
    logger.debug('pomelo.channelService(%s) add(%s, %s) userAmount=%s', identifier, context.channelUid, context.frontServerId, channel.getUserAmount())
}

exp.leave = function(identifier, context) {
    var channel = getChannel(identifier)
    channel.leave(context.channelUid, context.frontServerId)
    logger.debug('pomelo.channelService(%s) leave(%s, %s) userAmount=%s', identifier, context.channelUid, context.frontServerId, channel.getUserAmount())
}

exp.destroy = function(identifier) {
    var channel = getChannel(identifier)
    if (channel.getUserAmount() !== 0) {
        throw new Error(util.format('pomelo.channelService userAmount should be 0, userAmount=%s', channel.getUserAmount()))
    }
    channel.destroy()
    logger.debug('pomelo.channelService(%s) destroy', identifier)
}

var getChannel = function(identifier) {
    return app.get('channelService').getChannel(identifier, true)
}