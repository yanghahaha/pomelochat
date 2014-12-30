var _ = require('underscore')
var frontchannelService = require('../../../modules/frontChannel')
var utils = require('../../../util/utils')

module.exports = function(app) {
    return new Remote(app)
}

var Remote = function(app) {
    this.app = app
}

var remote = Remote.prototype

remote.sendServerMsg = function(route, msg, cb) {
    var opts = {
        type: 'broadcast',
        userOptions: {
            binded: true
        }
    }
    this.app.components.__connector__.send(null, route, msg, null, opts, cb)
}

remote.sendChannelMsg = function(channelIds, route, msg, cb) {
    var opts = {}
    var connector = this.app.components.__connector__

    _.each(channelIds, function(channelId) {
        var rooms = frontchannelService.getChannel(channelId)
        if (!!rooms) {
            _.each(rooms, function(room){
                connector.send(null, route, msg, room, opts, null)
            })
        }
    })

    utils.invokeCallback(cb)
}

remote.sendRoomMsg = function(channelId, roomIds, route, msg, cb) {
    var opts = {}
    var connector = this.app.components.__connector__

    _.each(roomIds, function(roomId){
        var room = frontchannelService.getRoom(channelId, roomId)
        if (!!room) {
            connector.send(null, route, msg, room, opts, null)
        }
    })

    utils.invokeCallback(cb)
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
remote.kick = function(channelToSids, route, msg, cb) {
    var opts = {}
    var sessionService = this.app.get('sessionService')
    var connector = this.app.components.__connector__    

    _.each(channelToSids, function(channel, channelId){
        var roomId = channel.roomId,
            sIds = channel.sIds

        if (!!route) {
            connector.send(null, route, msg, sIds, opts, null)   
        }

        _.each(sIds, function(sId){            
            frontchannelService.remove(channelId, roomId, sId)
            var session = sessionService.get(sId)
            if (!!session) {
                session.closed('kick')
            }
        })
    })
    
    utils.invokeCallback(cb)
}

remote.getConnetionStat = function(cb) {
    cb(null, this.app.components.__connection__.getStatisticsCount())
}