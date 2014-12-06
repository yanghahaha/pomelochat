var _ = require('underscore')
var util = require('util')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Config = require('../util/config')
var Code = require('../util/code')
var ChannelService = require('./channel')

var users = {}, exp = module.exports

exp.createUser = function(id) {
    if (!!users[id]) {
        return users[id]
    }

    var user = new User(id)
    users[id] = user

    logger.debug('create user id=%s', id)
    return user
}

// bad name, but same with others
exp.destroyUser = function(id) {
    var user = users[id]
    if (user.getChannelCount() !== 0) {
        throw new Error(
            util.format('destroy user channel count should be 0, user.getChannelCount()=%s', user.getChannelCount()))
    }
    for (var i in user) {
        user[i] = null
    }        
    delete users[id]
    logger.debug('destroy user id=%s', id)
}

exp.getUser = function(id) {
    return users[id]
}

var User = function(id, baseData) {
    this.id = id
    this.channelDatas = {}
    if (!!baseData) {
        this.updateBase(baseData)
    }
}

User.prototype.updateBase = function(baseData) {
    for (var i in baseData) {
        this[i] = baseData[i]
    }
}

User.prototype.getChannelData = function(channelId) {
    return this.channelDatas[channelId]
}

User.prototype.getChannelCount = function() {
    return _.keys(this.channelDatas).length
}

User.prototype.enterChannel = function(channelId, channelData, context, varOut) {
    if (this.getChannelCount()>= Config.ROOM.USER_MAX_CHANNEL) {
        return Code.ROOM.USER_CHANNEL_MEET_MAX
    }

    var userChannelData = this.channelDatas[channelId]
    var reenter = false, userChannelRoomId
    if (userChannelData) {
        userChannelRoomId = userChannelData.getRoomId()
        reenter = true
    }

    var out = {}
    var code = ChannelService.getChannel(channelId).enter(this, reenter, userChannelRoomId, context, out)
    if (code !== Code.SUCC) {
        return code
    }

    if (!userChannelData) {
        userChannelData = new UserChannelData()
        this.channelDatas[channelId] = userChannelData
    }

    userChannelData.setRole(channelData.role)
    userChannelData.setRoomId(out.roomId)
    userChannelData.addContext(context)

    varOut.roomId = out.roomId
    return Code.SUCC
}

User.prototype.leaveChannel = function(channelId, context) {
    var userChannelData = this.channelDatas[channelId]
    if (!userChannelData) {
        logger.warn('user=%s not in channel=%s', this.id, context)
        return Code.ROOM.USER_NOT_IN_CHANNEL
    }

    var index = userChannelData.findContext(context)
    if (index === -1) {
        logger.warn('user=%s context.remote=%j not in channel=%s', this.id, context.remote, channelId)
        return Code.ROOM.USER_CTX_NOT_FOUND
    }
    userChannelData.removeContextByIndex(index)
    var lastLeave = (userChannelData.getContextCount() === 0)
    if (lastLeave) {
        delete this.channelDatas[channelId]
    }

    ChannelService.getChannel(channelId).leave(this, lastLeave, userChannelData.getRoomId(), context)
}

var UserChannelData = function(opts) {
    for (var i in opts) {
        this[i] = opts[i]
    }
    this.contexts = []
}

UserChannelData.prototype.getRole = function() {
    return this.role
}

UserChannelData.prototype.setRole = function(role) {
    this.role = role
}

UserChannelData.prototype.getRoomId = function() {
    return this.roomId
}

UserChannelData.prototype.setRoomId = function(roomId) {
    this.roomId = roomId
}

UserChannelData.prototype.getContexts = function() {
    return this.contexts
}

UserChannelData.prototype.getContextCount = function() {
    return this.contexts.length
}

UserChannelData.prototype.addContext = function(ctx) {
    this.contexts.push(ctx)
}

UserChannelData.prototype.removeContext = function(ctx) {
    var found = false
    for (var i=0; i<this.contexts.length; ++i) {
        if (this.contexts[i].remote.ip === ctx.remote.ip &&this.contexts[i].remote.port === ctx.remote.port) {
            found = true
            break
        }
    }
    if (found) {
        this.contexts.splice(i, 1)
    }
}

UserChannelData.prototype.removeContextByIndex = function(index) {
    this.contexts.splice(index, 1)
}

UserChannelData.prototype.existContext = function(ctx) {
    return this.findContext(ctx) !== -1
}

UserChannelData.prototype.findContext = function(ctx) {
    for (var i=0; i<this.contexts.length; ++i) {
        if (this.contexts[i].remote.ip === ctx.remote.ip &&this.contexts[i].remote.port === ctx.remote.port) {
            return i
        }
    }
    return -1
}

