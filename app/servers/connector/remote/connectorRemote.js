var _ = require('underscore')
var frontChannelService = require('../../../modules/frontChannel')
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
        var rooms = frontChannelService.getChannel(channelId)
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

    roomIds.unshift(0)

    _.each(roomIds, function(roomId){
        var room = frontChannelService.getRoom(channelId, roomId)
        if (!!room) {
            connector.send(null, route, msg, room, opts, null)
        }
    })

    utils.invokeCallback(cb)
}

/*
channelToSids = {
    channelId1: {
        roomId1: [sId1, sId2, ...]
    }
    channelId2: {...}
}
*/
remote.kick = function(channelToSids, route, msg, cb) {
    var opts = {}
    var sessionService = this.app.get('sessionService')
    var connector = this.app.components.__connector__    

    _.each(channelToSids, function(channel, channelId){
        _.each(channel, function(sIds, roomId){

            if (!!route) {
                connector.send(null, route, msg, sIds, opts, null)   
            }

            _.each(sIds, function(sId){
                frontChannelService.remove(channelId, roomId, sId)
                var session = sessionService.get(sId)
                if (!!session) {
                    session.closed('kick')
                }
            })
        })
    })
    
    utils.invokeCallback(cb)
}

remote.getConnetionStat = function(cb) {
    cb(null, this.app.components.__connection__.getStatisticsCount())
}