var _ = require('underscore');
var randomString = require('random-string');
var logger = require('pomelo-logger').getLogger('auth', __filename, process.pid);
var Code = require('../util/code');

/*
tokens = {
    token1: {userId1, channelId1, data1}
    token2: {userId2, channelId2, data2}
}
*/
var tokens = {};

/*
timeToTokens = {
    time1: [token1, token2, ...]
    time2: [token1, token2, ...]
}
*/
var timeToTokens = {};

/*
userToTokens = {
    userId1: {
        channelId1: token1,
        channelId2: token2
    } userId2: ...
}
*/
var userToTokens = {};
var expireSecond;

var exp = module.exports;

exp.init = function(opts) {
    opts = opts || {};
    expireSecond = opts.expireSecond || 10;
    setInterval(clearExpiredToken, 1000);
};

exp.apply = function(userId, channelId, data, out) {
    if (!!userToTokens[userId] && !!userToTokens[userId][channelId]) {
        removeToken(userToTokens[userId][channelId]);
    }

    var token;
    do {
        token = genToken();
    } while (!!tokens[token]);

    addToken(token, userId, channelId, data);
    out.token = token;
    return Code.SUCC;
};

exp.verify = function(userId, channelId, token, out) {
    var tokenData = tokens[token];
    if (!tokenData) {
        logger.debug("token not found, token=%s", token);
        return Code.AUTH.TOKEN_INVALID;
    }
    if (tokenData.userId != userId) {
        logger.debug("token.userId not match, token.userId=%s userId=%s", tokenData.userId, userId);
        return Code.AUTH.TOKEN_INVALID;
    }
    if (tokenData.channelId != channelId) {
        logger.debug("token.channel not match, token.channelId=%s uchannelId=%s", tokenData.channelId, channelId);
        return Code.AUTH.TOKEN_INVALID;
    }

    removeToken(token);
    out.data = tokenData.data;
    return Code.SUCC;
};

var genToken = function() {
    return randomString({length: 20});
};

var addToken = function(token, userId, channelId, data) {
    tokens[token] = {
        userId: userId,
        channelId: channelId,
        data: data
    };

    if (!userToTokens[userId]) {
        userToTokens[userId] = {};
    }
    userToTokens[userId][channelId] = token;

    var expireTime = process.uptime() + expireSecond;
    if (!timeToTokens[expireTime]) {
        timeToTokens[expireTime] = [];
    }
    timeToTokens[expireTime].push(token);

    logger.debug("add token, token=%s userId=%s channelId=%s", token, userId, channelId);
};

var removeToken = function(token) {
    var tokenData = tokens[token];
    if (!tokenData) {
        return;
    }

    if (!!userToTokens[tokenData.userId] && !!userToTokens[tokenData.userId][tokenData.channelId]) {
        delete userToTokens[tokenData.userId][tokenData.channelId];
        if (_.isEmpty(userToTokens[tokenData.userId])) {
            delete userToTokens[tokenData.userId];
            logger.debug("remove userToTokens[%s] ", tokenData.userId);
        }
    }

    delete tokens[token];
    logger.debug("remove token, token=%s userId=%s channelId=%s", token, tokenData.userId, tokenData.channelId);
};

var clearExpiredToken = function() {
    var now = process.uptime();
    for (var time in timeToTokens) {
        if (time <= now) {
            _.each(timeToTokens[time], removeToken);
            delete timeToTokens[time];
        }
    }
};
