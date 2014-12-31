var _ = require('underscore')
var randomString = require('random-string')
var logger = require('pomelo-logger').getLogger('token', __filename, process.pid)
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
        channelId1: token1,
        channelId2: token2
    } userId2: ...
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

exp.apply = function(userId, channelId, data, out) {
    if (!!userToTokens[userId] && !!userToTokens[userId][channelId]) {
        removeToken(userToTokens[userId][channelId])
    }

    var token
    do {
        token = genToken()
    } while (!!tokens[token])

    addToken(token, userId, channelId, data)
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

var addToken = function(token, userId, channelId, data) {
    tokens[token] = {
        userId: userId,
        channelId: channelId,
        data: data
    }

    if (!userToTokens[userId]) {
        userToTokens[userId] = {}
    }
    userToTokens[userId][channelId] = token

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

    if (!!userToTokens[tokenData.userId] && !!userToTokens[tokenData.userId][tokenData.channelId]) {
        delete userToTokens[tokenData.userId][tokenData.channelId]
        if (_.isEmpty(userToTokens[tokenData.userId])) {
            delete userToTokens[tokenData.userId]
            logger.debug("remove userToTokens[%s] ", tokenData.userId)
        }
    }

    delete tokens[token]
    logger.debug("remove token, token=%s userId=%s channelId=%s", token, tokenData.userId, tokenData.channelId)
}

var clearExpiredToken = function() {
    var timeout = config.get('token.timeout') || 30
    var timeoutTime = process.uptime() - timeout

    while(!!timeQueue[0] && timeQueue[0].time <= timeoutTime) {
        var timeToTokens = timeQueue.shift()
        _.each(timeToTokens.tokens, removeToken)
    }
}
