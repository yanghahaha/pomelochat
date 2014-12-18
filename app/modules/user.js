var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var Config = require('../util/config')
var Code = require('../util/code')
var ChannelService = require('./channel')

var users = {}
var count = 0

var exp = module.exports

exp.createUser = function(id) {
    if (!!users[id]) {
        return users[id]
    }

    var user = new User(id)
    users[id] = user

    count++

    logger.debug('create user id=%s', id)
    return user
}

// bad name, but same with others
exp.destroyUser = function(id) {
    var user = users[id]
    if (user.getChannelCount() !== 0) {
        logger.fatal('destroy user channel count should be 0, user.getChannelCount()=%s', user.getChannelCount())
    }
    for (var i in user) {
        user[i] = null
    }        
    delete users[id]
    count--

    logger.debug('destroy user id=%s', id)
}

exp.getUser = function(id) {
    return users[id]
}

exp.getCount = function() {
    return count
}

exp.dump = function() {
    var dumps = {}
    for (var i in users) {
        dumps[i] = users[i].dump()
    }
    return dumps
}

var User = function(id, data) {
    this.id = id
    this.data = {}    
    this.channelDatas = {}
    if (!!data) {
        this.updateData(data)
    }
}

User.prototype.updateData = function(data) {
    for (var i in data) {
        this.data[i] = data[i]
    }
}

User.prototype.getChannelData = function(channelId) {
    return this.channelDatas[channelId]
}

User.prototype.getChannelCount = function() {
    return _.keys(this.channelDatas).length
}

User.prototype.dump = function() {
    return this
}

User.prototype.enter = function(channelId, channelData, context, varOut) {
    if (this.getChannelCount()>= Config.USER_MAX_CHANNEL) {
        return Code.CHANNEL.USER_CHANNEL_MEET_MAX
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

    userChannelData.roomId = out.roomId
    userChannelData.addContext(context)

    varOut.roomId = out.roomId
    return Code.SUCC
}

User.prototype.leave = function(channelId, context) {
    var userChannelData = this.channelDatas[channelId]
    if (!userChannelData) {
        logger.warn('user=%s not in channel=%s', this.id, channelId)
        return Code.CHANNEL.USER_NOT_IN_CHANNEL
    }

    var leaveConnection, lastLeave, 
        ret = {roomId: userChannelData.roomId}

    if (!!context) {
        var index = userChannelData.findContext(context)
        if (index === -1) {
            logger.warn('user=%s context.remote=%j not in channel=%s', this.id, context.remote, channelId)
            return Code.CHANNEL.USER_CTX_NOT_FOUND
        }
        userChannelData.removeContextByIndex(index)
        leaveConnection = 1
        lastLeave = (userChannelData.getContextCount() === 0)
        ret.contexts = [context]
    }
    else {
        leaveConnection = userChannelData.getContextCount()
        lastLeave = true
        ret.contexts = userChannelData.getContexts()
    }

    if (lastLeave) {
        delete this.channelDatas[channelId]
    }

    ChannelService.getChannel(channelId).leave(this, lastLeave, leaveConnection, userChannelData.roomId, context)
    return contexts
}


/*
ret = {
    channelId1: {
        roomId: roomId
        contexts: []
    },
    channelId2: {...}
}
*/
User.prototype.leaveAll = function() {
    var contexts = {}
    for (var i in this.channelDatas) {
        contexts[i] = this.leave(i)
    }
    return contexts
}

var UserChannelData = function() {
    this.roomId = null
    this.contexts = []
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
