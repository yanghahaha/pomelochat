var _ = require('underscore')
var randomString = require('random-string')
var logger = require('pomelo-logger').getLogger('auth', __filename, 'pid:'+process.pid)
var Code = require('../util/code')
var config = require('../util/config')

/*
tokens = {
    token1: {userId1, channelId1, data1}
    token2: {userId2, channelId2, data2}
}
*/
var tokens = {}

/*
timeToTokens = [
    {time1:, tokens:[token1, token2, ...]}
]
*/
var timeQueue = []

/*
userToTokens = {
    userId1: {
        channelId1: [token1],
        channelId2: [token2]
    } 
    userId2: ...
}
*/
var userToTokens = {}

/*
{
    applyCount
    verifyCount
    verifyFailCount
    verifySuccCount
    timeoutCount
*/
var stats = {
    applyCount: 0,
    verifyFailCount: 0,
    verifySuccCount: 0
}

var exp = module.exports

exp.init = function() {
    setInterval(clearExpiredToken, 1000)
}

exp.apply = function(userId, channelId, role, data, out) {
    if (!!userToTokens[userId] && !!userToTokens[userId][channelId]) {
        var maxUserConnectionCount = config.get('channel.maxUserConnectionCount') || 5
        var userChannelTokens = userToTokens[userId][channelId]
        while (userChannelTokens.length >= maxUserConnectionCount) {
            removeToken(userChannelTokens.shift())
        }
    }

    var token
    do {
        token = genToken()
    } while (!!tokens[token])

    addToken(token, userId, channelId, role, data)
    out.token = token
    stats.applyCount++
    return Code.SUCC
}

exp.verify = function(userId, channelId, token, out) {
    var tokenData = tokens[token]
    if (!tokenData) {
        logger.debug("token not found, token=%s", token)
        stats.verifyFailCount++
        return Code.TOKEN_INVALID
    }
    if (tokenData.userId != userId) {
        logger.debug("token.userId not match, token.userId=%s userId=%s", tokenData.userId, userId)
        stats.verifyFailCount++
        return Code.TOKEN_INVALID
    }
    if (tokenData.channelId != channelId) {
        logger.debug("token.channel not match, token.channelId=%s uchannelId=%s", tokenData.channelId, channelId)
        stats.verifyFailCount++
        return Code.TOKEN_INVALID
    }

    removeToken(token)
    out.role = tokenData.role
    out.data = tokenData.data
    stats.verifySuccCount++
    return Code.SUCC
}

exp.getStats = function() {
    return stats
}

var genToken = function() {
    return randomString({length: 20})
}

var addToken = function(token, userId, channelId, role, data) {
    tokens[token] = {
        userId: userId,
        channelId: channelId,
        role: role,
        data: data
    }

    if (!userToTokens[userId]) {
        userToTokens[userId] = {}
    }
    if (!userToTokens[userId][channelId]) {
        userToTokens[userId][channelId] = []
    }
    userToTokens[userId][channelId].push(token)

    var now = process.uptime()
    var timeToTokens = timeQueue[timeQueue.length-1]
    if (!timeToTokens || timeToTokens.time !== now) {
        timeToTokens = {
          time: now,
          tokens: [token]
        }
        timeQueue.push(timeToTokens)
    }
    else {
        timeToTokens.tokens.push(token)
    }

    logger.debug("add token, token=%s userId=%s channelId=%s", token, userId, channelId)
}

var removeToken = function(token) {
    var tokenData = tokens[token]
    if (!tokenData) {
        return
    }

    delete tokens[token]
    logger.debug("delete token token=%s userId=%s channelId=%s", token, tokenData.userId, tokenData.channelId)

    if (!!userToTokens[tokenData.userId] && !!userToTokens[tokenData.userId][tokenData.channelId]) {
        var userChannelTokens = userToTokens[tokenData.userId][tokenData.channelId]
        var i = 0
        for (; i<userChannelTokens.length; ++i) {
            if (userChannelTokens[i] === token) {
                break
            }
        }
        if (i < userChannelTokens.length) {
            userChannelTokens.splice(i,1)
            logger.debug("delete userToTokens[%s][%s][%s] after userChannelTokens=%j", tokenData.userId, tokenData.channelId, i, userChannelTokens)
            if (userChannelTokens.length === 0) {
                delete userToTokens[tokenData.userId][tokenData.channelId]
                logger.debug("delete userToTokens[%s][%s]", tokenData.userId, tokenData.channelId)
                if (_.isEmpty(userToTokens[tokenData.userId])) {
                    delete userToTokens[tokenData.userId]
                    logger.debug("delete userToTokens[%s]", tokenData.userId)
                }
            }
        }
        else {
            logger.debug("not found token %s in userChannelTokens", token)
        }
    }
}

var clearExpiredToken = function() {
    var timeout = config.get('token.timeout') || 30
    var timeoutTime = process.uptime() - timeout

    while(!!timeQueue[0] && timeQueue[0].time <= timeoutTime) {
        var timeToTokens = timeQueue.shift()
        _.each(timeToTokens.tokens, removeToken)
    }
}
