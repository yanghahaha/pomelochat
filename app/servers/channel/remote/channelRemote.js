var ChannelService = require('../../../modules/channel')
var UserService = require('../../../modules/user')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
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
    user.updateData(userData)

    var newChannel = false
    if (!ChannelService.getChannel(channelId)) {
        ChannelService.createChannel(channelId)
        newChannel = true
    }

    var out = {}
    var code = user.enter(channelId, context, out)
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
        cb(null, Code.CHANNEL.USER_NOT_EXIST)
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

remote.kick = function(userId, channelId, cb) {
    //todo
}


/**************************************************
    send msg
***************************************************/
remote.sendChannelMsg = function(channelId, msg, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
        return
    }

    var code = channel.sendMsg(msg)
    cb(null, code)
}

remote.sendRoomMsg = function(channelId, roomId, msg, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
        return
    }

    var room = channel.getRoom(roomId)
    if (!room) {
        cb(null, Code.CHANNEL.ROOM_NOT_EXIST)
        return        
    }

    var code = room.sendMsg(msg)
    cb(null, code)
}

remote.sendRoomMsgByUserId = function(channelId, userId, msg, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        cb(null, Code.CHANNEL.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.CHANNEL.USER_NOT_IN_CHANNEL)
        return        
    }

    this.sendRoomMsg(channelId, userChannel.roomId, msg, cb)
}


/**************************************************
    get user count
***************************************************/
remote.getServerUserCount = function(cb) {
    cb(null, UserService.getCount())
}

remote.getChannelUserCount = function(channelId, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
    }
    else {
        cb(null, Code.SUCC, channel.getUserCount())
    }
}

remote.getRoomUserCount = function(channelId, roomId, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
        return
    }

    var room = channel.getRoom(roomId)
    if (!room) {
        cb(null, Code.CHANNEL.ROOM_NOT_EXIST)
        return
    }

    cb(null, Code.SUCC, room.getUserCount())
}

remote.getRoomUserCountByUserId = function(channelId, userId, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        cb(null, Code.CHANNEL.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.CHANNEL.USER_NOT_IN_CHANNEL)
        return        
    }

    this.getRoomUserCount(channelId, userChannel.roomId, cb)
}


/**************************************************
    get user list
***************************************************/
remote.getChannelUsers = function(channelId, dataKeys, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
    }
    else {
        cb(null, Code.SUCC, channel.getUsers(dataKeys))
    }
}

remote.getRoomUsers = function(channelId, roomId, dataKeys, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
        return
    }

    var room = channel.getRoom(roomId)
    if (!room) {
        cb(null, Code.CHANNEL.ROOM_NOT_EXIST)
        return
    }

    cb(null, Code.SUCC, room.getUsers(dataKeys))
}

remote.getRoomUsersByUserId = function(channelId, userId, dataKeys, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        cb(null, Code.CHANNEL.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        cb(null, Code.CHANNEL.USER_NOT_IN_CHANNEL)
        return        
    }

    this.getRoomUsers(channelId, userChannel.roomId, cb)
}

/**************************************************
    dump
***************************************************/
remote.dumpUser = function(userId, cb) {
    var user = UserService.getUser(userId)
    if (!user) {
        cb(null, Code.CHANNEL.USER_NOT_EXIST)
        return
    }
    cb(null, Code.SUCC, user.dump())
}

remote.dumpUsers = function(cb) {
    cb(null, Code.SUCC, UserService.dump())
}

remote.dumpChannel = function(channelId, cb) {
    var channel = ChannelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL.CHANNEL_NOT_EXIST)
        return
    }
    cb(null, Code.SUCC, channel.dump())       
}

remote.dumpChannels = function(cb) {
    cb(null, Code.SUCC, ChannelService.dump())
}
