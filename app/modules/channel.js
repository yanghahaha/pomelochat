var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Room = require('./room')
var Code = require('../util/code')
var Config = require('../util/config')

var channels = {}

var exp = module.exports

exp.getChannel = function(id, opts) {
    var channel = channels[id]
    if (!channel) {
        channel = new Channel(id, opts)
        channels[id] = channel
    }
    return channel
}

var firstRoomDispatcher = function(channel) {
    return _.find(channel.rooms, function(room) {
        return room.getUserCount() < channel.roomMaxUser
    })
}

var lastRoomDispatcher = function(channel) {
    var lastRoom = channel.rooms[channel.lastRoomIndex]
    if (!!lastRoom && lastRoom.getUserCount() < channel.roomMaxUser) {
        return channel.lastRoomIndex
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

    this.channelMaxUser = opts.channelMaxUser || Config.ROOM.CHANNEL_MAX_USER
    this.channelMaxConnection = opts.channelMaxConnection || Config.ROOM.CHANNEL_MAX_CONNECTION
    this.channelMaxUserConnection = opts.channelMaxUserConnection || Config.ROOM.CHANNEL_MAX_USER_CONNECTION
    this.roomMaxUser = opts.roomMaxUser || Config.ROOM.ROOM_MAX_USER
    this.userDispatcher = opts.userDispatcher || lastRoomDispatcher
}

Channel.prototype.enter = function(user, context, out) {
    var code, room, newUser = true

    if (this.connectionCount >= this.channelMaxConnection) {
        return Code.ROOM.CHANNEL_CONNECTION_MEET_MAX
    }

    var userChannel = user.getChannel(this.id)
    if (!!userChannel) {
        if (userChannel.contexts.length >= this.channelMaxUserConnection) {
            return Code.ROOM.CHANNEL_USER_CONNECTION_MEET_MAX
        }
        room = this.rooms[userChannel.roomId]
        newUser = false
    }
    else {
        if (this.userCount >= this.channelMaxUser) {
            return Code.ROOM.CHANNEL_USER_MEET_MAX
        }
        room = this.findRoom()
    }

    code = room.enter(user, context, newUser)
    if (code != Code.SUCC) {
        return code
    }

    if (newUser) {
        ++this.userCount
    }
    ++this.connectionCount

    out.roomId = room.id

    logger.debug('user=%s newUser=%s entered channel=%s channel.userCount=%s channel.connectionCount=%s room=%s room.userCount=%s room.connectionCount=%s', 
        user.id, newUser, this.id, this.userCount, this.connectionCount, room.id, room.userCount, room.connectionCount)

    return Code.SUCC
}

Channel.prototype.findRoom = function() {
    var roomIndex = this.userDispatcher.call(null, this)
    var room = this.rooms[roomIndex]
    if (!room) {
        roomIndex = ++this.lastRoomIndex
        room = Room.create({
            channel: this,
            id: roomIndex
        })
        this.rooms[roomIndex] = room
        logger.debug("new room create channelId=%s roomId=%d", this.id, room.id)
    }

    logger.debug("channel=%s find room index=%s", this.id, room.id)
    return room
}