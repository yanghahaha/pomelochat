var _ = require('underscore')
var logger = require('pomelo-logger').getLogger('channel', __filename, process.pid)
var tokenService = require('../../../modules/token')
var Code = require('../../../util/code')

module.exports = function(app) {
    return new Remote(app)
}

var Remote = function(app) {
    this.app = app
}

var remote = Remote.prototype

remote.applyToken = function(userId, channelId, data, cb) {
    var out = {}
    var code = tokenService.apply(userId, channelId, data, out)
    cb(null, code, out.token)
}

remote.verifyToken = function(token, userId, channelId, cb) {
    var out = {}
    var code = tokenService.verify(userId, channelId, token, out)
    if (code !== Code.SUCC) {
        cb(null, code)
    }
    else {
        cb(null, code, out.data)
    }
}