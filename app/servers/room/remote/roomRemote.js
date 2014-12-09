var util = require('util')
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
    var code = user.enter(channelId, userData.channel, context, out)
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

    user.leave(channelId, context)
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

remote.chat = function(userId, channelId, content, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        cb(new Error(util.format('chat from user not in server userId=%s', userId)))
        return
    }

    var toUser = null
    if (!!toUserId) {
        toUser = UserService.getUser(toUserId) 
        if (!toUser) {
            cb(null, Code.ROOM.TO_USER_NOT_IN_SERVER)
            return
        }
    }

    var code = user.chat(channelId, toUser, content)
    logger.debug('chat fromId=%s to toId=%s in channelId=%s code=%s', userId, toUserId, channelId, code)
    cb(null, code)
}