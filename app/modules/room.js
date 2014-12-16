var util = require('util')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Code = require('../util/code')
var Consts = require('../util/consts')

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
    this.messenger = this.messenger || require('../messenger/pomeloMessenger')
}

Room.prototype.getIdentifier = function() {
    return this.channel.id + '-' + this.id
}

Room.prototype.getUserCount = function() {
    return this.userCount
}

Room.prototype.enter = function(user, reenter, context) {
    if (!reenter) {
        ++this.userCount
        this.users[user.id] = user
        this.messenger.add(this.getIdentifier(), context)        
    }
    ++this.connectionCount
    return Code.SUCC
}

Room.prototype.leave = function(user, lastLeave, context) {
    if (lastLeave) {
        --this.userCount
        delete this.users[user.id]
        this.messenger.leave(this.getIdentifier(), context)
    }
    --this.connectionCount

    if (this.userCount === 0 || this.connectionCount === 0) {
        if (this.connectionCount !== this.connectionCount) {
            throw new Error(util.format('destroy room all count should be 0, this.userCount=%s this.connectionCount=%s', this.userCount, this.connectionCount))
        }
        this.messenger.destroy(this.getIdentifier())
    }
}

Room.prototype.sendMsg = function(msg) {
    this.messenger.pushMessage(this.getIdentifier(), Consts.SENT_MSG_ROUTE, msg)
    return Code.SUCC
}
