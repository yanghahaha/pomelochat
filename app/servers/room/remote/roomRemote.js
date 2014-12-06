var ChannelService = require('../../../modules/channel')
var UserService = require('../../../modules/user')
var logger = require('pomelo-logger').getLogger('room', __filename, process.pid)

module.exports = function(app) {
	return new Remote(app)
}

var Remote = function(app) {
	this.app = app
}

var remote = Remote.prototype

remote.enter = function(userId, channelId, userData, context, cb) {
    var user = UserService.getUser(userId)
    user.updateBase(userData.base)

    var code = user.enterChannel(channelId, userData.channel, context)
    logger.debug('enter userId=%s channelId=%s userData=%j context=%j code=%s', userId, channelId, userData, context, code)

    cb(null, code, {})
}
