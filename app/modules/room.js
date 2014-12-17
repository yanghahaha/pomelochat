var util = require('util')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var Code = require('../util/code')

var exp = module.exports

exp.create = function(opts) {
    logger.debug('create room id=%s', opts.id)
    return new Room(opts)
}

exp.destroy = function(room) {
    logger.debug('destroy room id=%s', room.id)
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
}

Room.prototype.getUserCount = function() {
    return this.userCount
}

Room.prototype.getUsers = function(dataKeys) {
    dataKeys = dataKeys || {}
    var users = {}
    for (var i in this.users) {
        var data = {}
        for (var j in dataKeys) {
            data[j] = this.users[i].data[j]
        }
        users[i] = data
    }

    return users
}

Room.prototype.enter = function(user, reenter) {
    if (!reenter) {
        ++this.userCount
        this.users[user.id] = user
    }
    ++this.connectionCount
    return Code.SUCC
}

Room.prototype.leave = function(user, lastLeave) {
    if (lastLeave) {
        --this.userCount
        delete this.users[user.id]
    }
    --this.connectionCount

    if (this.userCount === 0 || this.connectionCount === 0) {
        if (this.connectionCount !== this.connectionCount) {
            throw new Error(util.format('destroy room all count should be 0, this.userCount=%s this.connectionCount=%s', this.userCount, this.connectionCount))
        }
    }
}
