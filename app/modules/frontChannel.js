var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('connector', __filename, 'pid:'+process.pid)

var channels = {}
var channelSessionCount = {}

var exp = module.exports

exp.getChannel = function(channelId) {
    return channels[channelId]
}

exp.getRoom = function(channelId, roomId) {
    if (!channels[channelId]) {
        return undefined
    }
    return channels[channelId][roomId]
}

exp.add = function(channelId, roomId, sessionId) {
    if (!channels[channelId]) {
        channels[channelId] = {}
        channelSessionCount[channelId] = {}
    }
    if (!channels[channelId][roomId]) {
        channels[channelId][roomId] = {}
        channelSessionCount[channelId][roomId] = 0
    }
    if (!channels[channelId][roomId][sessionId]) {
        channels[channelId][roomId][sessionId] = true
        channelSessionCount[channelId][roomId] ++
    }
}

exp.remove = function(channelId, roomId, sessionId) {
    if (!channels[channelId]) {
        return
    }
    if (!roomId) {
        for (var rId in channels[channelId]) {
            if (!!channels[channelId][rId][sessionId]) {
                roomId = rId
                break
            }
        }
        if (!roomId) {
            return
        }
    }

    if (!channels[channelId][roomId] || !channels[channelId][roomId][sessionId]) {
        return
    }
    delete channels[channelId][roomId][sessionId]
    channelSessionCount[channelId][roomId] --

    if (channelSessionCount[channelId][roomId] <= 0) {
        var length = _.keys(channels[channelId][roomId]).length
        if (length !== 0) {
            logger.warn('channelSessionCount[channelId][roomId] !== length, length=%s supposed te be 0', length)
            channelSessionCount[channelId][roomId] = length
        }
        else {
            delete channels[channelId][roomId]
            delete channelSessionCount[channelId][roomId]

            if (_.keys(channels[channelId]).length === 0) {
                delete channels[channelId]
                delete channelSessionCount[channelId]
            }
        }
    }
}

exp.dump = function() {
    return {
        channels: channels,
        channelSessionCount: channelSessionCount
    }
}