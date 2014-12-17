var _ = require('underscore')
var util = require('util')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var Room = require('./room')
var Code = require('../util/code')
var Config = require('../util/config')

var channels = {}

var exp = module.exports

exp.createChannel = function(id, opts) {
    if (!!channels[id]) {
        return channels[id]
    }

    var channel = new Channel(id, opts)
    channels[id] = channel

    logger.debug('create channel id=%s', id)
    return channel
}

exp.destroyChannel = function(id) {
    var channel = channels[id]
    if (channel.userCount !== 0 || channel.connectionCount !== 0) {
        throw new Error(
            util.format('destroy channel all count should be 0, channel.userCount=%s channel.connectionCount=%s', 
                channel.userCount, channel.connectionCount))
    }
    for (var i in channel) {
        channel[i] = null
    }    
    delete channels[id]

    logger.debug('destroy channel id=%s', id)
}

exp.getChannel = function(id) {
    return channels[id]
}

exp.dump = function() {
    var dumps = {}
    for (var i in channels) {
        dumps[i] = channels[i].dump()
    }
    return dumps
}


var firstRoomDispatcher = function(channel) {
    return _.find(channel.rooms, function(room) {
        return room.getUserCount() < channel.roomMaxUser
    })
}

var lastRoomDispatcher = function(channel) {
    var lastRoom = channel.rooms[channel.lastRoomIndex]
    if (!!lastRoom && lastRoom.getUserCount() < channel.roomMaxUser) {
        return lastRoom
    }
    else {
        return null
    }
}

var Channel = function(id, opts) {
    opts = opts || {}
    this.id = id
    this.lastRoomIndex = 0
    this.userCount = 0
    this.connectionCount = 0
    this.rooms = {}

    this.channelMaxUser = opts.channelMaxUser || Config.CHANNEL_MAX_USER
    this.channelMaxConnection = opts.channelMaxConnection || Config.CHANNEL_MAX_CONNECTION
    this.channelMaxUserConnection = opts.channelMaxUserConnection || Config.CHANNEL_MAX_USER_CONNECTION
    this.roomMaxUser = opts.roomMaxUser || Config.ROOM_MAX_USER
    this.userDispatcher = opts.userDispatcher || lastRoomDispatcher || firstRoomDispatcher
}

Channel.prototype.getUserCount = function() {
    return this.userCount
}

Channel.prototype.getUsers = function(dataKeys) {
    var users = {}
    for (var i in this.rooms) {
        users[i] = this.rooms[i].getUsers(dataKeys)
    }
    return users
}

Channel.prototype.dump = function() {
    var rooms = {}
    for (var i in this.rooms) {
        var room = this.rooms[i]
        rooms[i] = {
            id: room.id,
            userCount: room.userCount,
            connectionCount: room.connectionCount
        }
    }

    return {
        id: this.id,
        userCount: this.userCount,
        connectionCount: this.connectionCount,
        rooms: rooms
    }
}

Channel.prototype.enter = function(user, reenter, userInRoomId, context, out) {
    var code, room

    if (this.connectionCount >= this.channelMaxConnection) {
        return Code.CHANNEL_CONNECTION_MEET_MAX
    }

    if (!!userInRoomId) {
        if (user.getChannelData(this.id).getContextCount() >= this.channelMaxUserConnection) {
            return Code.CHANNEL_USER_CONNECTION_MEET_MAX
        }
        room = this.rooms[userInRoomId]
    }
    else {
        if (this.userCount >= this.channelMaxUser) {
            return Code.CHANNEL_USER_MEET_MAX
        }
        room = this.findRoomForNewUser()
    }

    code = room.enter(user, reenter, context)
    if (code !== Code.SUCC) {
        return code
    }

    if (!reenter) {
        ++this.userCount
    }
    ++this.connectionCount

    out.roomId = room.id

    logger.debug('channel.enter user=%s reenter=%s channel=%s channel.userCount=%s channel.connectionCount=%s room=%s room.userCount=%s room.connectionCount=%s', 
        user.id, reenter, this.id, this.userCount, this.connectionCount, room.id, room.userCount, room.connectionCount)

    return Code.SUCC
}

Channel.prototype.leave = function(user, lastLeave, userInRoomId, context) {
    var room = this.rooms[userInRoomId]
    room.leave(user, lastLeave, context)

    if (lastLeave) {
        --this.userCount
    }
    --this.connectionCount

    logger.debug('channel.leave user=%s lastLeave=%s channel=%s channel.userCount=%s channel.connectionCount=%s room=%s room.userCount=%s room.connectionCount=%s', 
        user.id, lastLeave, this.id, this.userCount, this.connectionCount, room.id, room.userCount, room.connectionCount)

    if (room.getUserCount() === 0) {
        Room.destroy(room)
        delete this.rooms[userInRoomId]
    }
}

Channel.prototype.findRoomForNewUser = function() {
    var room = this.userDispatcher.call(null, this)
    if (!room) {
        ++this.lastRoomIndex
        room = Room.create({
            channel: this,
            id: this.lastRoomIndex
        })
        this.rooms[this.lastRoomIndex] = room
        logger.debug("new room create channelId=%s roomId=%d", this.id, room.id)
    }

    logger.debug("channel=%s find room index=%s", this.id, room.id)
    return room
}

Channel.prototype.getRoom = function(roomId) {
    return this.rooms[roomId]
}
