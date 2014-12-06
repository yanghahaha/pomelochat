var ChannelService = require('../../../modules/channel')
var UserService = require('../../../modules/user')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Code = require('../../../util/code')

module.exports = function(app) {
	return new Remote(app)
}

var Remote = function(app) {
	this.app = app
}

var remote = Remote.prototype

remote.enter = function(userId, channelId, userData, context, cb) {
    var newUser = false
    var user = UserService.getUser(userId)
    if (!user) {
        user = UserService.createUser(userId)
        newUser = true
    }
    user.updateBase(userData.base)

    var newChannel = false
    if (!ChannelService.getChannel(channelId)) {
        ChannelService.createChannel(channelId)
        newChannel = true
    }

    var out = {}
    var code = user.enterChannel(channelId, userData.channel, context, out)
    if (code !== Code.SUCC) {
        if (newUser) {
            UserService.destroyUser(userId)
        }
        if (newChannel) {
            ChannelService.destroyChannel(channelId)
        }
    }

    logger.debug('enter userId=%s channelId=%s userData=%j context=%j code=%s', userId, channelId, userData, context, code)
    cb(null, code, {
        roomId: out.roomId
    })
}

remote.leave = function(userId, channelId, context, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        logger.warn('leave userId=%s not found', userId)        
        cb(null, Code.ROOM.USER_NOT_IN_SERVER)
        return
    }

    user.leaveChannel(channelId, context)
    if (user.getChannelCount() === 0) {
        UserService.destroyUser(userId)
    }

    var channel = ChannelService.getChannel(channelId)
    if (channel.getUserCount() === 0) {
        ChannelService.destroyChannel(channelId)
    }

    logger.debug('leave userId=%s channelId=%s context=%j', userId, channelId, context)
    cb(null, Code.SUCC)
}