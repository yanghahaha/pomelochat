var async = require('async')
var Code = require('../../../util/code')
var Utils = require('../../../util/utils')
var logger = require('pomelo-logger').getLogger('connector', __filename, process.pid)

module.exports = function(app) {
	return new Handler(app)
}

var Handler = function(app) {
		this.app = app
}

var handler = Handler.prototype

/*
req = {
    userId:
    channelId:
    token:
}
res = {
    code:
}
*/
handler.login = function(req, session, next) {
    var self = this,
        userId = req.userId,
        channelId = req.channelId,
        userData, roomData,
        code = Code.INTERNAL_SERVER_ERROR
    var uId = Utils.getSessionUid(userId, channelId)

    async.waterfall([
        function(cb) {
            session.bind(uId, function(err) {
                if (!!err) {
                    code = Code.CONNECTOR.BIND_SESSION_ERROR
                }
                cb(err)
            })
        },
        function(cb) {
            self.app.rpc.auth.authRemote.verifyToken(session, userId, channelId, req.token, cb)
        },
        function(ret, data, cb) {
            code = ret
            if (code != Code.SUCC) {
                cb(new Error('authRemote.verifyToken fail'))
            }
            else {
                userData = data
                cb(null)
            }
        },
        function(cb) {
            self.app.rpc.room.roomRemote.enter(session, userId, channelId, userData, {
                frontServerId: self.app.get('serverId'),
                channelUid: uId,
                remote: self.app.sessionService.getClientAddressBySessionId(session.id)
            }, cb)
        },
        function(ret, data, cb) {
            code = ret
            if (code != Code.SUCC) {
                cb(new Error('roomRemote.enter fail'))
            }
            else {
                roomData = data
                cb(null)
            }
        }
    ], function(err) {
        if (!!err) {
            logger.warn("login error, userId=%s channelId=%s sId=%s code=%s err=%s", userId, channelId, sId, code, err)
            next(null, {
                code: code
            })
            self.app.sessionService.kickBySessionId(session.id)
        }
        else {
            session.on('closed', onUserLeave.bind(null, self.app))
            next(null, {
                code: Code.SUCC,
                user: userData,
                room: roomData
            })
        }
    })
}

handler.chat = function(req, session, next) {

}

