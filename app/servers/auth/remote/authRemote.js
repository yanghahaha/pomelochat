var tokenService = require('../../../modules/token.js');
var Code = require('../../../util/code.js');
var logger = require('pomelo-logger').getLogger('auth', __filename, process.pid);

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

var remote = Remote.prototype;

/*
 data = {
    base: {
        name:
        level:
    }
    channel: {
        role:
    }
 }
*/
remote.applyToken = function(userId, channelId, data, cb) {
    var out = {};
    var code = tokenService.apply(userId, channelId, data, out);
    cb(null, code, out.token);
};

remote.verifyToken = function(userId, channelId, token, cb) {
    var out = {};
    var code = tokenService.verify(userId, channelId, token, out);
    cb(null, code, out.data);
};
