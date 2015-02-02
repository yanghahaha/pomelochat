var logger = require('pomelo-logger').getLogger('connector', __filename, process.pid)
var async = require('async')
var Code = require('../../../util/code')
var Utils = require('../../../util/utils')
var frontChannelService = require('../../../modules/frontChannel')

module.exports = function(app) {
	return new Handler(app)
}

var Handler = function(app) {
    this.app = app
    setInterval(sendLeaveMsgBatch.bind(null, app), 1000)
}

var handler = Handler.prototype

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
        code = Code.INTERNAL_SERVER_ERROR,
        retData, userData
    var uId = Utils.getSessionUid(userId, channelId)
    var remote = self.app.sessionService.getClientAddressBySessionId(session.id)
    if (!remote) {
        next(null, {
            code: Code.INTERNAL_SERVER_ERROR
        });
        self.app.sessionService.kickBySessionId(session.id);
        return;        
    }

    var context = {
            fId: self.app.get('serverId'),
            sId: session.id,
            remote: {
                ip: remote.ip,
                port: remote.port
            }
        }

    async.waterfall([
        function(cb) {
            self.app.rpc.auth.authRemote.verifyToken(session, req.token, userId, channelId, cb)
        },
        function(ret, data, cb) {
            cb = arguments[arguments.length-1]
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
            if (!session.isValid()) {
                cb(new Error('session invalid sid='+session.id))
                return
            }

            session.on('closed', onUserLeave.bind(null, self.app))
            session.set('userId', userId)
            session.set('channelId', channelId)
            session.set('context', context)
            session.pushAll()

            session.bind(uId, function(err) {
                if (!!err) {
                    code = Code.DUPLICATED_LOGIN
                }
                logger.info('bind userId=%s channelId=%s err=%s', userId, channelId, err)
                cb(err)
            })
        },
        function(cb) {
            if (!session.isValid()) {
                cb(new Error('session invalid sid='+session.id))
                return
            }
            logger.info('enter userId=%s channelId=%s', userId, channelId)
            self.app.rpc.channel.channelRemote.enter(session, userId, channelId, userData, context, cb)
        },
        function(ret, data, cb) {
            cb = arguments[arguments.length-1]
            code = ret
            if (code !== Code.SUCC) {
                cb(new Error('channelRemote.enter fail'))
            }
            else if (!session.isValid()) {
                cb(new Error('session invalid sid='+session.id))
            }
            else {
                retData = data
                session.set('roomId', retData.roomId)
                session.push('roomId')                    
                cb()
            }
        }
    ], function(err) {
        if (!!err) {
            logger.debug("login error userId=%s channelId=%s token=%s code=%s err=%s stack=%s", userId, channelId, req.token, code, err.toString(), err.stack)
            if (session.isValid()) {
                next(null, {
                    code: code
                })
                self.app.sessionService.kickBySessionId(session.id)
            }
        }
        else {
            frontChannelService.add(channelId, retData.roomId, session.id)
            logger.debug('login succ userId=%s channelId=%s token=%s', userId, channelId, req.token)
            next(null, {
                code: Code.SUCC,
                data: {
                    //roomId: retData.roomId,
                    user: userData
                }
            })
        }
    })
}

var leaveMsgs = []

var onUserLeave = function(app, session, reason) {
    if (!session || !session.get('userId') || reason === 'kick') {
        return
    }

    var userId = session.get('userId'),
        channelId = session.get('channelId'),
        roomId = session.get('roomId'),
        context = session.get('context')

    session.set('userId', null)
    session.push('userId')

    if (!!roomId) {
        frontChannelService.remove(channelId, roomId, session.id)
    }

    logger.info('onUserLeave userId=%s channelId=%s roomId=%s reason=%s', userId, channelId, roomId, reason)

    leaveMsgs.push({
        channelId: channelId,
        userId: userId,
        context: context,
        roomId: roomId
    })
}

var sendLeaveMsgBatch = function(app) {
    if (leaveMsgs.length > 0) {
        var msgs = leaveMsgs
        leaveMsgs = []
        app.rpc.channel.channelRemote.leaveBatch.toServer('*', msgs, function(err, code, failed){
            if (failed.length > 0) {
                logger.info('leave batch failed=%j', failed)
            }
        })
    }
}