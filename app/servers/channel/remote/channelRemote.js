var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var dangerIplogger = require('pomelo-logger').getLogger('danger-ip')
var channelService = require('../../../modules/channel')
var userService = require('../../../modules/user')
var Code = require('../../../util/code')
var utils = require('../../../util/utils')
var config = require('../../../util/config')

module.exports = function(app) {
	return new Remote(app)
}

var Remote = function(app) {
	this.app = app
}

var remote = Remote.prototype

remote.enter = function(userId, channelId, userData, context, cb) {
    logger.info('enter begin userId=%s channelId=%s context=%j', userId, channelId, context)

    var range = config.get('user.dangerPortRange')
    if (_.isArray(range) && range.length >= 2 && context.remote.port >= range[0] && context.remote.port <= range[1]) {
        dangerIplogger.warn('%s:%s', context.remote.ip, context.remote.port)
        var reject = config.get('user.dangerPortReject')
        if (!!reject) {
            logger.info('enter userId=%s channelId=%s context=%j code=%s', userId, channelId, context, Code.USER_DANGER_PORT_REJECT)
            cb(null, Code.USER_DANGER_PORT_REJECT)       
            return             
        }
    }

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

    var out = {}
    var code = user.enter(channelId, context, out)
    if (code !== Code.SUCC) {
        if (newUser) {
            userService.destroyUser(userId)
        }
        if (newChannel) {
            channelService.destroyChannel(channelId)
        }
    }

    logger.info('enter userId=%s channelId=%s roomId=%s context=%j code=%s', userId, channelId, out.roomId, context, code)
    cb(null, code, {
        roomId: out.roomId
    })
}

remote.leave = function(userId, channelId, context, cb) {
    logger.info('leave begin userId=%s channelId=%s context=%j', userId, channelId, context) 
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('leave userId=%s not found', userId)
        logger.fatal('arguments=%j', arguments)     
        logger.fatal('cb=%s', cb.toString())     
        logger.fatal('stack=%s', new Error().stack)
        logger.fatal('userdump=%j', userService.dump())
        var util = require('util')
        logger.fatal('util.inspect=%s', util.inspect(userService.getUsers(), {showHidden:true, depth: 10}))
        var heapdump = require('heapdump');
        heapdump.writeSnapshot('/tmp/channel.heapsnapshot.' + Date.now() + '.' + process.pid)
        logger.info('code=Code.USER_NOT_EXIST') 
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var out = {}
    var code = user.leave(channelId, context, out)
    if (code !== Code.SUCC) {
        logger.info('code=%s', code) 
        cb(null, code)
        return        
    }

    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    var channel = channelService.getChannel(channelId)
    if (!!channel && channel.getUserCount() === 0) {
        channelService.destroyChannel(channelId)
    }

    logger.info('leave userId=%s channelId=%s roomId=%s context=%j', userId, channelId, out.roomId, context)
    cb(null, Code.SUCC)
}

remote.leaveBatch = function(users, cb) {
    logger.info('leaveBatch begin users.length=%s users=%j', users.length, users)
    var self = this
    var checker = function(err, code) {        
        if (code !== Code.SUCC) {
            logger.fatal('code=%s', code)
        }
    }

    for (var i=0; i<users.length; ++i) {
        var user = users[i]
        self.leave(user.userId, user.channelId, user.context, checker)
    }

    logger.info('leaveBatch end users.length=%s', users.length)
    cb(null, Code.SUCC)
}

remote.kickUser = function(userId, channelId, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('kickUser userId=%s not found', userId)
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var outData = {}
    if (!!channelId) {
        var channelIds
        if (_.isArray(channelId)) {
            channelIds = channelId
        }
        else {
            channelIds = [channelId]
        }

        _.each(channelIds, function(cId) {
            var ctx = {}
            if (user.leave(cId, null, ctx) === Code.SUCC) {
                outData[cId] = {}
                outData[cId][ctx.roomId] = ctx.contexts
            }
        })
    }
    else {
        var out = {}
        user.leaveAll(out)
        _.each(out, function(ctx, cId){
            outData[cId] = {}
            outData[cId][ctx.roomId] = ctx.contexts
        })
    }

    _.each(outData, function(data, cId){
        var channel = channelService.getChannel(cId)
        if (!!channel && channel.getUserCount() === 0) {
            channelService.destroyChannel(cId)
        }
    })

    if (user.getChannelCount() === 0) {
        userService.destroyUser(userId)
    }

    logger.info('kickUser userId=%s channelId=%j', userId, channelId)
    cb(null, Code.SUCC, outData)
}

remote.kickIp = function(ip, cb) {
    var outData = {}
    var innerIpData = {}    
    var ipData = userService.getIps()[ip]
    if (!!ipData) {
        _.each(ipData.users, function(datas, userId){
            if (!innerIpData[userId]) {
                innerIpData[userId] = []
            }
            _.each(datas, function(data){
                innerIpData[userId].push(data)
            })
        })

        _.each(innerIpData, function(datas, userId){
            var user = userService.getUser(userId)
            if (!!user) {
                _.each(datas, function(data){
                    var out = {}
                    user.leave(data.channelId, data.context, out)
                    if (!outData[data.channelId]) {
                        outData[data.channelId] = {}
                    }
                    if (!outData[data.channelId][out.roomId]) {
                        outData[data.channelId][out.roomId] = []
                    }
                    outData[data.channelId][out.roomId].push(data.context)

                    var channel = channelService.getChannel(data.channelId)
                    if (!!channel && channel.getUserCount() === 0) {
                        channelService.destroyChannel(data.channelId)
                    }
                })

                if (user.getChannelCount() === 0) {
                    userService.destroyUser(userId)
                }
            }
        })
    }

    logger.info('kickIp ip=%s data=%j', ip, innerIpData)
    cb(null, Code.SUCC, outData)
}

remote.getRoomIdByUserId = function(channelId, userId, cb) {
    logger.info('getRoomIdByUserId begin')
    var user = userService.getUser(userId)
    if (!user) {
        logger.info('code = Code.USER_NOT_EXIST')
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var userChannel = user.getChannelData(channelId)
    if (!userChannel) {
        logger.info('code = Code.USER_NOT_IN_CHANNEL')
        cb(null, Code.USER_NOT_IN_CHANNEL)
        return        
    }

    logger.info('code = Code.SUCC')
    cb(null, Code.SUCC, userChannel.roomId)
}

/**************************************************
    log msg count
***************************************************/
remote.logMsgCount = function(min, channelId, roomIds, msgCount, cb) {
    var channel = channelService.getChannel(channelId)
    if (!!channel) {
        if (!min) {
            min = Date.now() / 60000 | 0
        }
        _.each(roomIds, function(roomId){
            var room = channel.getRoom(roomId)
            if (!room) {
                logger.error('statRoomMsg room not found channel=%s room=%s', channelId, roomId)
            }
            else {
                room.logMsgCount(min, msgCount)
            }
        })

        channelService.logMsgCount(min, msgCount)
    }
    utils.invokeCallback(cb)
}

remote.logMsgCountBatch = function(min, channels, cb) {
    logger.info('logMsgCountBatch begin')
    if (!min) {
        min = Date.now() / 60000 | 0
    }

    var self = this
    _.each(channels, function(channel, channelId){
        _.each(channel, function(msgCount, roomId){
            self.logMsgCount(min, channelId, [roomId], msgCount)
        })
    })

    logger.info('logMsgCountBatch end')
    utils.invokeCallback(cb)
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

remote.getAllChannelUserCount = function(cb) {
    var channelIds = _.keys(channelService.getChannels())
    this.getChannelUserCount(channelIds, cb)
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

/**************************************************
    top & sort
***************************************************/
remote.topChannels = function(topNum, cb) {
    cb(null, Code.SUCC, channelService.topChannels(topNum))
}

remote.topIps = function(topNum, cb) {
    cb(null, Code.SUCC, userService.topIps(topNum))
}

remote.sortIps = function(minCount, cb) {
    cb(null, Code.SUCC, userService.sortIps(minCount))
}

/**************************************************
    stats
***************************************************/
remote.getServerStats = function(cb) {
    cb(null, Code.SUCC, {
        stats: channelService.getStats(),
        userCount: userService.getUserCount(), 
        connectionCount: channelService.getConnectionCount(),
        channelCount: _.keys(channelService.getChannels()).length
    })
}