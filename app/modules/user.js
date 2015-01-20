var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var config = require('../util/config')
var Code = require('../util/code')
var ChannelService = require('./channel')

var users = {}
var count = 0

var ips = {}

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

exp.getUserCount = function() {
    return count
}

exp.dump = function() {
    var dumps = {}
    for (var i in users) {
        dumps[i] = users[i].dump()
    }
    return dumps
}

exp.sortIps = function(minCount) {
    var filteredIps
    if (!minCount) {
        filteredIps = ips
    }
    else {
        filteredIps = _.filter(ips, function(ip){
            return ip.count >= minCount
        })
    }

    return _.sortBy(filteredIps, function(ip){
        return -ip.count
    })
}

exp.topIps = function(topNum) {
    var sortedIps = _.sortBy(ips, function(ip){
        return -ip.count
    })
    if (!!topNum) {
        sortedIps.splice(topNum)
    }
    return sortedIps
}

exp.getIps = function() {
    return ips
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

User.prototype.enter = function(channelId, context, varOut) {
    if (this.getChannelCount()>= config.get('user.maxChannelCount')) {
        return Code.USER_CHANNEL_MEET_MAX
    }
    if (!!ips[context.remote.ip] && ips[context.remote.ip].count >= config.get('user.maxIpCount')) {
        var maxIpExclude = config.get('user.maxIpExclude')
        if (!!maxIpExclude && _.isArray(maxIpExclude)) {
            if (maxIpExclude.indexOf(context.remote.ip) === -1) {
                return Code.USER_IP_MEET_MAX
            }
        }
        else {
            return Code.USER_IP_MEET_MAX
        }
    }

    var userChannelData = this.channelDatas[channelId]
    var reenter = false, 
        userChannelRoomId

    if (userChannelData) {
        userChannelRoomId = userChannelData.roomId
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

    addIp(context.remote.ip, this.id, channelId, out.roomId, context)

    varOut.roomId = out.roomId
    return Code.SUCC
}

User.prototype.leave = function(channelId, context, out) {
    var userChannelData = this.channelDatas[channelId]
    if (!userChannelData) {
        logger.warn('user=%s not in channel=%s', this.id, channelId)
        return Code.USER_NOT_IN_CHANNEL
    }

    var leaveConnection, lastLeave
    out.roomId = userChannelData.roomId

    if (!!context) {
        var index = userChannelData.findContext(context)
        if (index === -1) {
            logger.warn('user=%s context.remote=%j not in channel=%s', this.id, context.remote, channelId)
            return Code.USER_CTX_NOT_FOUND
        }
        userChannelData.removeContextByIndex(index)
        leaveConnection = 1
        lastLeave = (userChannelData.getContextCount() === 0)
        out.contexts = [context]
    }
    else {
        leaveConnection = userChannelData.getContextCount()
        lastLeave = true
        out.contexts = userChannelData.getContexts()
    }

    if (lastLeave) {
        delete this.channelDatas[channelId]
    }

    ChannelService.getChannel(channelId).leave(this, lastLeave, leaveConnection, userChannelData.roomId, context)

    var userId = this.id
    _.each(out.contexts, function(ctx){
        removeIp(ctx.remote.ip, userId, channelId, out.roomId, ctx)
    })

    return Code.SUCC
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
User.prototype.leaveAll = function(out) {
    for (var i in this.channelDatas) {
        var ctx = {}
        if (this.leave(i, null, ctx) === Code.SUCC) {
            out[i] = ctx
        }
    }
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
    ctx.__time__ = Date.now() / 1000 | 0
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

var addIp = function(ip, userId, channelId, roomId, context) {
    if (!ips[ip]) {
        ips[ip] = {
            ip: ip,      
            count: 0,
            users: {}
        }
    }
    if (!ips[ip].users[userId]) {
        ips[ip].users[userId] = []
    }

    ips[ip].count++

    ips[ip].users[userId].push({
        channelId: channelId,
        roomId: roomId,
        context: context        
    })
}

var removeIp = function(ip, userId, channelId, roomId, context) {
    if (!ips[ip] || !ips[ip].users[userId]) {
        logger.error('remove ip not found. ip=%s userId=%s channelId=%s roomId=%s', ip, userId, channelId, roomId)
        return
    }

    var ipUser = ips[ip].users[userId]
    for (var i=0; i<ipUser.length; ++i) {
        if (ipUser[i].context.remote.ip === context.remote.ip && ipUser[i].context.remote.port === context.remote.port) {
            ipUser.splice(i, 1)
            if (ipUser.length === 0) {
                delete ips[ip].users[userId]
            }
            ips[ip].count--
            if (ips[ip].count === 0) {
                delete ips[ip]
            }
            return
        }
    }

    logger.error('remove ip not found. ip=%s userId=%s channelId=%s roomId=%s', ip, userId, channelId, roomId)
}