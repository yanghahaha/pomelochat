var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Config = require('../util/config')
var Code = require('../util/code')
var ChannelService = require('./channel')

var users = {}

module.exports.getUser = function(id) {
    var user = users[id]
    if (!user) {
        user = new User(id)
        users[id] = user
    }
    return user
}

var User = function(id, baseData) {
    this.id = id
    this.channels = {
        // channelId: {
        //     role: role,
        //     roomId: roomId,
        //     contexts: []
        // }
    }
    if (!!baseData) {
        this.updateBase(baseData)
    }
}

User.prototype.updateBase = function(baseData) {
    for (var i in baseData) {
        this[i] = baseData[i]
    }
}

User.prototype.getChannel = function(channelId) {
    return this.channels[channelId]
}

User.prototype.enterChannel = function(channelId, channelData, context) {
    if (_.keys(this.channels).length >= Config.ROOM.USER_MAX_CHANNEL) {
        return Code.ROOM.USER_CHANNEL_MEET_MAX
    }

    var out = {}
    var code = ChannelService.getChannel(channelId).enter(this, context, out)
    if (code != Code.SUCC) {
        return code
    }

    var userChannel = this.channels[channelId]
    if (!userChannel) {
        userChannel = {
            role: null,
            roomId: null,
            contexts: []
        }
        this.channels[channelId] = userChannel
    }

    userChannel.role = channelData.role
    userChannel.roomId = out.roomId
    userChannel.contexts.push(context)

    return Code.SUCC
}
