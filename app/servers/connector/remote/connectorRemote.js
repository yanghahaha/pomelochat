var FrontChannelService = require('../../modules/frontChannel')

module.exports = function(app) {
    return new Remote(app)
}

var Remote = function(app) {
    this.app = app
}

var remote = Remote.prototype

remote.broadcastMsg = function(route, msg, opts, cb) {
    opts = opts || {}
    opts.type = 'broadcast'
    opts.binded = true
    this.app.components.__connector__.send(null, route, msg, null, opts, cb)
}

remote.sendChannelMsg = function(channelId, route, msg, opts, cb) {
    opts = opts || {}
    var connector = this.app.components.__connector__
    var rooms = FrontChannelService.getChannel(channelId)
    if (!!rooms) {
        for (var i in rooms) {
            connector.send(null, route, msg, rooms[i], opts, cb)
        }
    }
}

remote.sendRoomMsg = function(channelId, roomId, route, msg, opts, cb) {
    opts = opts || {}
    var connector = this.app.components.__connector__
    var room = FrontChannelService.getRoom(channelId, roomId)
    if (!!room) {
        connector.send(null, route, msg, room, opts, cb)
    }
}
