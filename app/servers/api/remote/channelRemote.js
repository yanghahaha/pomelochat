var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var channelService = require('../../../modules/channel')
var userService = require('../../../modules/user')
var tokenService = require('../../../modules/token');
var Code = require('../../../util/code')

module.exports = function(app) {
	return new Remote(app)
}

var Remote = function(app) {
	this.app = app
}

var remote = Remote.prototype

remote.applyToken = function(userId, channelId, data, cb) {
    var out = {}
    var code = tokenService.apply(userId, channelId, data, out)
    cb(null, code, out.token)
}

remote.enter = function(token, userId, channelId, context, cb) {
    var out = {}
    var code = tokenService.verify(userId, channelId, token, out)
    if (code !== Code.SUCC) {
        cb(null, code)
        return
    }

    var userData = out.data

    var newUser = false
    var user = userService.getUser(userId)
    if (!user) {
        user = userService.createUser(userId)
        newUser = true
    }
    user.updateData(userData)

    var newChannel = false
    if (!channelService.getChannel(channelId)) {
        channelService.createChannel(channelId)
        newChannel = true
    }

    out = {}
    code = user.enter(channelId, context, out)
    if (code !== Code.SUCC) {
        if (newUser) {
            userService.destroyUser(userId)
        }
        if (newChannel) {
            channelService.destroyChannel(channelId)
        }
    }

    logger.debug('enter userId=%s channelId=%s userData=%j context=%j code=%s', userId, channelId, userData, context, code)
    cb(null, code, {
        roomId: out.roomId
    })
}

remote.leave = function(userId, channelId, context, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('leave userId=%s not found', userId)        
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    user.leave(channelId, context)
    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    var channel = channelService.getChannel(channelId)
    if (channel.getUserCount() === 0) {
        channelService.destroyChannel(channelId)
    }

    logger.debug('leave userId=%s channelId=%s context=%j', userId, channelId, context)
    cb(null, Code.SUCC)
}

remote.kick = function(userId, channelId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('leave userId=%s not found', userId)        
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var contexts = {}
    if (!!channelId) {
        contexts[channelId] = user.leave(channelId)
    }
    else {
        contexts = user.leaveAll()
    }

    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    logger.debug('kick userId=%s channelId=%s ', userId, channelId)
    cb(null, Code.SUCC, contexts)
}

remote.getRoomIdByUserId = function(channelId, userId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.USER_NOT_IN_CHANNEL)
        return        
    }

    cb(null, Code.SUCC, userChannel.roomId)
}


/**************************************************
    get user count
***************************************************/
remote.getServerUserCount = function(cb) {
    cb(null, userService.getCount())
}

remote.getChannelUserCount = function(channelId, cb) {
    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
    }
    else {
        cb(null, Code.SUCC, channel.getUserCount())
    }
}

remote.getRoomUserCount = function(channelId, roomId, cb) {
    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
        return
    }

    var room = channel.getRoom(roomId)
    if (!room) {
        cb(null, Code.ROOM_NOT_EXIST)
        return
    }

    cb(null, Code.SUCC, room.getUserCount())
}

remote.getRoomUserCountByUserId = function(channelId, userId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.USER_NOT_IN_CHANNEL)
        return        
    }

    this.getRoomUserCount(channelId, userChannel.roomId, cb)
}


/**************************************************
    get user list
***************************************************/
remote.getChannelUsers = function(channelId, dataKeys, cb) {
    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
    }
    else {
        cb(null, Code.SUCC, channel.getUsers(dataKeys))
    }
}

remote.getRoomUsers = function(channelId, roomId, dataKeys, cb) {
    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
        return
    }

    var room = channel.getRoom(roomId)
    if (!room) {
        cb(null, Code.ROOM_NOT_EXIST)
        return
    }

    cb(null, Code.SUCC, room.getUsers(dataKeys))
}

remote.getRoomUsersByUserId = function(channelId, userId, dataKeys, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.USER_NOT_IN_CHANNEL)
        return        
    }

    this.getRoomUsers(channelId, userChannel.roomId, cb)
}

/**************************************************
    dump
***************************************************/
remote.dumpUser = function(userId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        cb(null, Code.USER_NOT_EXIST)
        return
    }
    cb(null, Code.SUCC, user.dump())
}

remote.dumpUsers = function(cb) {
    cb(null, Code.SUCC, userService.dump())
}

remote.dumpChannel = function(channelId, cb) {
    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
        return
    }
    cb(null, Code.SUCC, channel.dump())       
}

remote.dumpChannels = function(cb) {
    cb(null, Code.SUCC, channelService.dump())
}
