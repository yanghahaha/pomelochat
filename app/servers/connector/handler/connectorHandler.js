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
    var self = this
    if (!req.userId || !req.channelId || !req.token) {
        next(null, {
            code: Code.BAD_REQUEST
        });
        self.app.sessionService.kickBySessionId(session.id);
        return;
    }

    var userId = req.userId,
        channelId = req.channelId,
        userData, roomData,
        code = Code.INTERNAL_SERVER_ERROR
    var uId = Utils.getSessionUid(userId, channelId)
    var context = {
            frontServerId: self.app.get('serverId'),
            channelUid: uId,
            remote: self.app.sessionService.getClientAddressBySessionId(session.id)
        }

    async.waterfall([
        function(cb) {
            self.app.rpc.auth.authRemote.verifyToken(session, userId, channelId, req.token, cb)
        },
        function(ret, data, cb) {
            code = ret
            if (code !== Code.SUCC) {
                cb(new Error('authRemote.verifyToken fail'))
            }
            else {
                userData = data
                cb(null)
            }
        },
        function(cb) {
            session.bind(uId, function(err) {
                if (!!err) {
                    code = Code.CONNECTOR.BIND_SESSION_ERROR
                }
                cb(err)
            })
        },
        function(cb) {
            self.app.rpc.room.roomRemote.enter(session, userId, channelId, userData, context, cb)
        },
        function(ret, data, cb) {
            code = ret
            if (code !== Code.SUCC) {
                cb(new Error('roomRemote.enter fail'))
            }
            else {
                roomData = data
                cb(null)
            }
        },
        function(cb) {
            session.set('userId', userId)
            session.set('channelId', channelId)
            session.set('roomId', roomData.roomId)
            session.set('context', context)
            session.on('closed', onUserLeave.bind(null, self.app))
            session.pushAll(cb)
        }
    ], function(err) {
        if (!!err) {
            logger.error("login error userId=%s channelId=%s code=%s err=%j", userId, channelId, code, err)
            next(null, {
                code: code
            })
            self.app.sessionService.kickBySessionId(session.id)
        }
        else {
            logger.debug('login succ userId=%s channelId=%s', userId, channelId)
            next(null, {
                code: Code.SUCC,
                user: userData,
                room: roomData
            })
        }
    })
}

var onUserLeave = function(app, session, reason) {
    if (!session || !session.get('userId')) {
        return
    }

    var userId = session.get('userId'),
        channelId = session.get('channelId'),
        context = session.get('context')

    app.rpc.room.roomRemote.leave(session, userId, channelId, context, function(err, code){
        if (!!err || code !== Code.SUCC) {
            logger.error('leave error userId=%s channelId=%s reason=%s code=%s error=%j', userId, channelId, reason, code, err)
        }
        else {
            logger.debug('leave succ userId=%s channelId=%s reason=%s', userId, channelId, reason)
        }
    })
}

/*
req = {
    toUserId
    content
}
*/
handler.chat = function(req, session, next) {
    var code = Code.SUCC,
        self = this

    if (!req.content) {
        code = Code.BAD_REQUEST
    }
    if (!session || !session.get('userId')) {
        code = Code.UNAUTHORIZED
    }

    if (code !== Code.SUCC) {
        next(null, {
            code: code
        });
        self.app.sessionService.kickBySessionId(session.id);
        return;                
    }

    var userId = session.get('userId'),
        channelId = session.get('channelId')

    self.app.rpc.room.roomRemote.chat(session, userId, channelId, req.content, function(err, code){
        if (!!err) {
            logger.error("chat error userId=%s channelId=%s code=%s err=%j", userId, channelId, code, err)
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
            self.app.sessionService.kickBySessionId(session.id);
        }
        else {
            logger.debug('chat succ userId=%s channelId=%s', userId, channelId)
            next(null, {
                code: code
            })
        }
    })
}
