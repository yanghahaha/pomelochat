var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, 'pid:'+process.pid)
var Room = require('./room')
var Code = require('../util/code')
var config = require('../util/config')
var MinuteStat = require('../util/minuteStat')

var channels = {}
var connectionCount = 0
var minuteStat = new MinuteStat()
var stats = {}

var exp = module.exports

exp.init = function() {
    var lastMin = 0
    setInterval(function(){
        var currMin = new Date() / 60000 | 0
        if (currMin > lastMin) {
            var debug = config.get('channel.statMsgCountMinuteDebug')
            if (!!debug) {
                console.time('channel.statMsgCountMinute')
            }
            lastMin = currMin
            var statMsgCountMinute = config.get('channel.statMsgCountMinute')
            if (_.isArray(statMsgCountMinute)) {
                _.each(channels, function(channel){
                    channel.statMsgCount(currMin, statMsgCountMinute)
                })
                stats = minuteStat.stat(currMin, statMsgCountMinute)
            }
            if (!!debug) {
                console.timeEnd('channel.statMsgCountMinute')
            }
        }
    }, 1000)
}

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
        logger.fatal('destroy channel all count should be 0, channel.userCount=%s channel.connectionCount=%s', 
                channel.userCount, channel.connectionCount)
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

exp.getChannels = function() {
    return channels
}

exp.dump = function() {
    var dumps = {}
    for (var i in channels) {
        dumps[i] = channels[i].dump()
    }
    return dumps
}

exp.topChannels = function(topNum) {
    var sortedChannels = _.sortBy(channels, function(channel){
        return -channel.userCount
    })
    if (!!topNum) {
        sortedChannels.splice(topNum)
    }
    var tops = []
    _.each(sortedChannels, function(channel){
        tops.push(channel.dump())
    })

    return tops
}

exp.getConnectionCount = function() {
    return connectionCount
}

exp.getStats = function() {
    return stats
}

exp.logMsgCount = function(min, msgCount) {
    minuteStat.log(min, msgCount)
}


var firstRoomDispatcher = function(params) {
    return _.find(params.rooms, function(room) {
        return room.getUserCount() < params.maxUserCount
    })
}

var lastRoomDispatcher = function(params) {
    if (!!params.lastRoom && params.lastRoom.getUserCount() < params.maxUserCount) {
        return params.lastRoom
    }
    return null
}

var dispatchers = {
    'firstRoomDispatcher': firstRoomDispatcher,
    'lastRoomDispatcher': lastRoomDispatcher
}

var Channel = function(id) {
    this.id = id
    this.lastRoom = null
    this.maxRoomIndex = 0
    this.userCount = 0
    this.connectionCount = 0
    this.rooms = {}
    this.minToMsgCount = []

    this.stats = {}
}

Channel.prototype.getUserCount = function() {
    return this.userCount
}

Channel.prototype.getConnectionCount = function() {
    return this.connectionCount
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
            connectionCount: room.connectionCount,
            stats: room.stats
        }
    }

    return {
        id: this.id,
        userCount: this.userCount,
        connectionCount: this.connectionCount,
        stats: this.stats,
        rooms: rooms
    }
}

Channel.prototype.enter = function(user, reenter, userInRoomId, context, out) {
    var code, room

    if (this.connectionCount >= config.get('channel.maxConnectionCount')) {
        return Code.CHANNEL_CONNECTION_MEET_MAX
    }

    if (!!userInRoomId) {
        if (user.getChannelData(this.id).getContextCount() >= config.get('channel.maxUserConnectionCount')) {
            return Code.CHANNEL_USER_CONNECTION_MEET_MAX
        }
        room = this.rooms[userInRoomId]
    }
    else {
        if (this.userCount >= config.get('channel.maxUserCount')) {
            return Code.CHANNEL_USER_MEET_MAX
        }
        room = this.findRoomForNewUser()
    }

    code = room.enter(user, reenter, context)
    if (code !== Code.SUCC) {
        return code
    }

    if (!reenter) {
        this.userCount++
    }
    this.connectionCount++
    connectionCount++

    out.roomId = room.id

    logger.debug('channel.enter user=%s reenter=%s channel=%s channel.userCount=%s channel.connectionCount=%s room=%s room.userCount=%s room.connectionCount=%s', 
        user.id, reenter, this.id, this.userCount, this.connectionCount, room.id, room.userCount, room.connectionCount)

    return Code.SUCC
}

Channel.prototype.leave = function(user, lastLeave, leaveConnection, userInRoomId, context) {
    var room = this.rooms[userInRoomId]
    room.leave(user, lastLeave, leaveConnection, context)

    if (lastLeave) {
        --this.userCount
    }
    this.connectionCount -= leaveConnection
    connectionCount -= leaveConnection

    logger.debug('channel.leave user=%s lastLeave=%s leaveConnection=%s channel=%s channel.userCount=%s channel.connectionCount=%s room=%s room.userCount=%s room.connectionCount=%s', 
        user.id, lastLeave, leaveConnection, this.id, this.userCount, this.connectionCount, room.id, room.userCount, room.connectionCount)

    if (room.getUserCount() === 0) {
        if (room === this.lastRoom) {
            this.lastRoom = null
        }
        Room.destroy(room)
        delete this.rooms[userInRoomId]
    }
}

Channel.prototype.findRoomForNewUser = function() {
    var dispatcherName = config.get('channel.userDispatcher')
    var dispatcher = dispatchers[dispatcherName]
    if (!dispatcher) {
        dispatcher = lastRoomDispatcher
        dispatcherName = 'lastRoomDispatcher'
    }

    var room = dispatcher.call(null, {
        rooms: this.rooms,
        lastRoom: this.lastRoom,
        maxUserCount: config.get('room.maxUserCount')
    })

    if (!room) {
        room = this.createNewRoom()
    }
    this.lastRoom = room

    logger.debug("channel=%s find room index=%s count=%s dispatcher=%s", this.id, room.id, room.getUserCount(), dispatcherName)
    return room
}

Channel.prototype.createNewRoom = function() {
    var index
    for (var i=1; i<=this.maxRoomIndex; ++i) {
        if (!this.rooms[i]) {
            index = i
            break
        }
    }
    if (!index) {
        index = ++this.maxRoomIndex
    }

    var room = Room.create({
        channelId: this.id,
        id: index
    })

    this.rooms[index] = room
    logger.debug("new room create channelId=%s roomId=%d", this.id, room.id)

    return room
}

Channel.prototype.getRoom = function(roomId) {
    return this.rooms[roomId]
}

Channel.prototype.statMsgCount = function(currMin, statMsgCountMinute) {
    var stats = {}
    _.each(statMsgCountMinute, function(min){
        stats[min] = 0
    })
    _.each(this.rooms, function(room){
        var roomStats = room.statMsgCount(currMin, statMsgCountMinute)
        for (var min in stats) {
            stats[min] += roomStats[min]
        }
    })

    this.stats = stats
    return stats
}