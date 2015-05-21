var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, 'pid:'+process.pid)
var channelService = require('./channel')
var userService = require('./user')
var Code = require('../util/code')
var config = require('../util/config')

var remote = module.exports
var users = {}

remote.enter = function(userId, channelId, userRole, userData, context, cb) {
    var range = config.get('user.dangerPortRange')
    if (_.isArray(range) && range.length >= 2 && context.remote.port >= range[0] && context.remote.port <= range[1]) {
        var reject = config.get('user.dangerPortReject')
        if (!!reject) {
            logger.warn('enter fail userId=%s channelId=%s context=%j code=%s', userId, channelId, context, Code.USER_DANGER_PORT_REJECT)
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
    var code = user.enter(channelId, userRole, context, out)
    if (code !== Code.SUCC) {
        if (newUser) {
            userService.destroyUser(userId)
        }
        if (newChannel) {
            channelService.destroyChannel(channelId)
        }

        logger.warn('enter fail userId=%s channelId=%s context=%j code=%s', userId, channelId, context, code)
    }
    else {
        addUser(userId, channelId, context)
        logger.info('enter succ userId=%s channelId=%s roomId=%s context=%j code=%s', userId, channelId, out.roomId, context, code)
    }

    cb(null, code, {
        roomId: out.roomId
    })
}

remote.leave = function(userId, channelId, context, cb) {
    var user = userService.getUser(userId)
    if (!user) {
        logger.warn('leave fail userId=%s channelId=%s context=%j code=%s', userId, channelId, context, Code.USER_NOT_EXIST)
        cb(null, Code.USER_NOT_EXIST)
        return
    }

    var out = {}
    var code = user.leave(channelId, context, out)
    if (code !== Code.SUCC) {
        logger.warn('leave fail userId=%s channelId=%s context=%j code=%s', userId, channelId, context, code)
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

    removeUser(userId, channelId, context)

    logger.info('leave succ userId=%s channelId=%s roomId=%s context=%j code=%s', userId, channelId, out.roomId, context, Code.SUCC)

    if (!!cb) {
        cb(null, Code.SUCC)
    }
}

remote.leaveServer = function(fId) {
    var serverUsers = users[fId]
    delete users[fId]

    var connCount = 0, userCount = 0
    for (var userId in serverUsers) {
        for (var channelId in serverUsers[userId]) {
            for (var i = 0; i<serverUsers[userId][channelId].length; ++i) {
                this.leave(userId, channelId, serverUsers[userId][channelId][i])
                connCount++
            }
            userCount++
        }
    }

    logger.fatal('leaveServer fId=%s userCount=%s connCount=%s', fId, userCount, connCount)
}

var addUser = function(userId, channelId, context) {
    if (!users[context.fId]) {
        users[context.fId] = {}
    }
    if (!users[context.fId][userId]) {
        users[context.fId][userId] = {}
    }
    if (!users[context.fId][userId][channelId]) {
        users[context.fId][userId][channelId] = []
    }
    users[context.fId][userId][channelId].push(context)
}

var removeUser = function(userId, channelId, ctx) {
    if (!users[ctx.fId]) {
        return
    }
    if (!users[ctx.fId][userId]) {
        return
    }
    if (!users[ctx.fId][userId][channelId]) {
        return
    }

    var contexts = users[ctx.fId][userId][channelId]
    var found = false
    for (var i=0; i<contexts.length; ++i) {
        if (contexts[i].remote.ip === ctx.remote.ip && contexts[i].remote.port === ctx.remote.port) {
            found = true
            break
        }
    }
    if (found) {
        contexts.splice(i, 1)
        if (contexts.length === 0) {
            delete users[ctx.fId][userId][channelId]
            if (_.keys(users[ctx.fId][userId]).length === 0) {
                delete users[ctx.fId][userId]
            }
        }
    }
}