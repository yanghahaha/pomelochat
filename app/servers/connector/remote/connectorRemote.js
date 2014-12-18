var frontchannelService = require('../../../modules/frontChannel')
var utils = require('../../../util/utils')

module.exports = function(app) {
    return new Remote(app)
}

var Remote = function(app) {
    this.app = app
}

var remote = Remote.prototype

remote.broadcastMsg = function(route, msg, cb) {
    var opts = {
        type: 'broadcast',
        userOptions: {
            binded: true
        }
    }
    this.app.components.__connector__.send(null, route, msg, null, opts, cb)
}

remote.sendChannelMsg = function(channelId, route, msg, cb) {
    var opts = {}
    var connector = this.app.components.__connector__
    var rooms = frontchannelService.getChannel(channelId)
    if (!!rooms) {
        for (var i in rooms) {
            connector.send(null, route, msg, rooms[i], opts, cb)
        }
    }
    else {
        utils.invokeCallback(cb)
    }
}

remote.sendRoomMsg = function(channelId, roomId, route, msg, cb) {
    var opts = {}
    var connector = this.app.components.__connector__
    var room = frontchannelService.getRoom(channelId, roomId)
    if (!!room) {
        connector.send(null, route, msg, room, opts, cb)
    }
    else {
        utils.invokeCallback(cb)
    }
}

/*
channelToSids = {
    channelId1: {
        roomId: roomId
        sIds: [sId1, sId2, ...]
    }
    channelId2: {...}
}
*/
remote.kick = function(channelToSids, cb) {
    var sessionService = this.app.get('sessionService')
    for (var channelId in channelToSids) {
        var roomId = channelToSids[channelId].roomId,
            sIds = channelToSids[channelId].sIds
        for (var i=0; i<sIds.length; ++i) {
            var sId = sIds[i]
            frontchannelService.remove(channelId, roomId, sId)
            var session = sessionService.get(sId)
            if (!!session) {
                session.closed('kick')
            }
        }
    }
    utils.invokeCallback(cb)
}