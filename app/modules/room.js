var logger = require('pomelo-logger').getLogger('channel', __filename, 'pid:'+process.pid)
var Code = require('../util/code')
var MinuteStat = require('../util/minuteStat')
var userService = require('./user')

var exp = module.exports

exp.create = function(opts) {
    logger.debug('create room id=%s', opts.id)
    return new Room(opts)
}

exp.destroy = function(room) {
    logger.debug('destroy room id=%s channelId=%s', room.id, room.channelId)
    for (var i in room) {
        room[i] = null
    }
}

var Room = function(opts) {
    for (var k in opts) {
        this[k] = opts[k]
    }
    this.users = {}
    this.userCount = 0
    this.connectionCount = 0

    this.minuteStat = new MinuteStat()
    this.stats = {}
}

Room.prototype.getUserCount = function() {
    return this.userCount
}

Room.prototype.getConnectionCount = function() {
    return this.connectionCount
}

Room.prototype.getUsers = function(dataKeys) {
    dataKeys = dataKeys || []
    var users = {}
    for (var i in this.users) {
        var data = null
        var user = userService.getUser(i)
        if (!!user) {
            data = {}
            for (var j=0; j<dataKeys.length; ++j) {
                var key = dataKeys[j]
                data[key] = user.data[key]
            }
        }
        users[i] = data
    }

    return users
}

Room.prototype.enter = function(user, reenter) {
    if (!reenter) {
        ++this.userCount
        this.users[user.id] = true
    }
    ++this.connectionCount
    return Code.SUCC
}

Room.prototype.leave = function(user, lastLeave, leaveConnection) {
    if (lastLeave) {
        --this.userCount
        delete this.users[user.id]
    }
    this.connectionCount -= leaveConnection

    if (this.userCount === 0 || this.connectionCount === 0) {
        if (this.connectionCount !== this.connectionCount) {
            logger.fatal('destroy room all count should be 0, this.userCount=%s this.connectionCount=%s', this.userCount, this.connectionCount)
        }
    }
}

Room.prototype.logMsgCount = function(min, msgCount) {
    this.minuteStat.log(min, msgCount)
}

 Room.prototype.statMsgCount = function(currTimeMin, minutesToStat) {
    this.stats = this.minuteStat.stat(currTimeMin, minutesToStat)
    return this.stats
}
