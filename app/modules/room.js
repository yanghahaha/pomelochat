var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)
var Code = require('../util/code')

module.exports.create = function(opts) {
  return new Room(opts)
}

var Room = function(opts) {
    for (var k in opts) {
        this[k] = opts[k]
    }
    this.users = {}
    this.userCount = 0
    this.connectionCount = 0
    this.messenger = this.messenger || require('./pomeloMessenger')
}

Room.prototype.enter = function(user, context, newUser) {
    if (newUser) {
        this.users[user.id] = user
        this.messenger.add(this.getIdentifier(), context)
        ++this.userCount
    }
    ++this.connectionCount
    return Code.SUCC
}

Room.prototype.getIdentifier = function() {
    return this.channel.id + '-' + this.id
}

Room.prototype.getUserCount = function() {
    return this.userCount
}