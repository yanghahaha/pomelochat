var _ = require('underscore')
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

    logger.info('enter userId=%s channelId=%s roomId=%s context=%j code=%s', userId, channelId, out.roomId,context, code)
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

    var out = {}
    user.leave(channelId, context, out)
    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    var channel = channelService.getChannel(channelId)
    if (channel.getUserCount() === 0) {
        channelService.destroyChannel(channelId)
    }

    logger.info('leave userId=%s channelId=%s roomId=%s context=%j', userId, channelId, out.roomId, context)
    cb(null, Code.SUCC)
}

remote.kick = function(userId, channelId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('kick userId=%s not found', userId)
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var out = {}
    if (!!channelId) {
        var ctx
        if (_.isArray(channelId)) {
            _.each(channelId, function(cId) {
                ctx = {}
                if (user.leave(cId, null, ctx) !== Code.SUCC) {
                    out[cId] = null
                }
                else {
                    out[cId] = ctx
                }
            })
        }
        else {
            ctx = {}
            var code = user.leave(channelId, null, ctx)
            if (code !== Code.SUCC) {
                cb(null, code)
                return            
            }
            out[channelId] = ctx
        }
    }
    else {
        user.leaveAll(out)
    }

    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    logger.info('kick userId=%s channelId=%j', userId, channelId)
    cb(null, Code.SUCC, out)
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
    cb(null, Code.SUCC, userService.getUserCount(), channelService.getConnectionCount())
}

remote.getChannelUserCount = function(channelIds, cb) {
    if (!_.isArray(channelIds)) {
        channelIds = [channelIds]
    }

    var counts = {}
    for (var i=0; i<channelIds.length; ++i) {
        var channelId = channelIds[i]
        var channel = channelService.getChannel(channelId)
        if (!channel) {
            counts[channelId] = null
        }
        else {
            counts[channelId] = {
                userCount: channel.getUserCount(),
                connectionCount: channel.getConnectionCount()   
            }
        }
    }
    cb(null, Code.SUCC, counts)
}

remote.getRoomUserCount = function(channelId, roomIds, cb) {
    if (!_.isArray(roomIds)) {
        roomIds = [roomIds]
    }

    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
        return
    }

    var counts = {}
    for (var i=0; i<roomIds.length; ++i) {
        var roomId = roomIds[i]
        var room = channel.getRoom(roomId)
        if (!room) {
            counts[roomId] = null
        }
        else {
            counts[roomId] = {
                userCount: room.getUserCount(),
                connectionCount: room.getConnectionCount()
            }
        }
    }

    cb(null, Code.SUCC, counts)
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

    this.getRoomUserCount(channelId, userChannel.roomId, function(err, code, counts){
        if (!!err || code !== Code.SUCC) {
            cb(err, code)
        }
        else {
            if (counts[userChannel.roomId] === null) {
                logger.fatal('user %s not in channel %s room %s, but should be in', userId, channelId, userChannel.roomId)
                cb(err, Code.INTERNAL_SERVER_ERROR)
            }
            else {
                cb(null, Code.SUCC, counts[userChannel.roomId].userCount, counts[userChannel.roomId].connectionCount)
            }
        }
    })
}


/**************************************************
    get user list
***************************************************/
remote.getChannelUsers = function(channelIds, dataKeys, cb) {
    if (!_.isArray(channelIds)) {
        channelIds = [channelIds]
    }

    var users = {}
    _.each(channelIds, function(channelId){
        var channel = channelService.getChannel(channelId)
        if (!channel) {
            users[channelId] = null
        }
        else {
            users[channelId] = channel.getUsers(dataKeys)
        }
    })

    cb(null, Code.SUCC, users)
}

remote.getRoomUsers = function(channelId, roomIds, dataKeys, cb) {
    if (!_.isArray(roomIds)) {
        roomIds = [roomIds]
    }

    var channel = channelService.getChannel(channelId)
    if (!channel) {
        cb(null, Code.CHANNEL_NOT_EXIST)
        return
    }

    var users = {}
    _.each(roomIds, function(roomId){
        var room = channel.getRoom(roomId)
        if (!room) {
            users[roomId] = null
        }
        else {
            users[roomId] = room.getUsers(dataKeys)
        }
    })

    cb(null, Code.SUCC, users)
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

    this.getRoomUsers(channelId, userChannel.roomId, dataKeys, function(err, code, users){
        if (!!err || code !== Code.SUCC) {
            cb(err, code)
        }
        else {
            if (users[userChannel.roomId] === null) {
                logger.fatal('user %s not in channel %s room %s, but should be in', userId, channelId, userChannel.roomId)
                cb(err, Code.INTERNAL_SERVER_ERROR)
            }
            else {
                cb(null, Code.SUCC, users[userChannel.roomId])
            }
        }
    })
}

/**************************************************
    dump
***************************************************/
remote.dumpUser = function(userIds, cb) {
    if (!_.isArray(userIds)) {
        userIds = [userIds]
    }

    var users = {}
    _.each(userIds, function(userId){
        var user = userService.getUser(userId)
        if (!user) {
            users[userId] = null
        }
        else {
            users[userId] = user.dump()
        }
    })

    cb(null, Code.SUCC, users)
}

remote.dumpAllUser = function(cb) {
    cb(null, Code.SUCC, userService.dump())
}

remote.dumpChannel = function(channelIds, cb) {
    if (!_.isArray(channelIds)) {
        channelIds = [channelIds]
    }

    var channels = {}
    _.each(channelIds, function(channelId){
        var channel = channelService.getChannel(channelId)
        if (!channel) {
            channels[channelId] = null
        }
        else {
            channels[channelId] = channel.dump()
        }
    })

    cb(null, Code.SUCC, channels)       
}

remote.dumpAllChannel = function(cb) {
    cb(null, Code.SUCC, channelService.dump())
}
