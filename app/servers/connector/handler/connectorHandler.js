var logger = require('pomelo-logger').getLogger('connector', __filename, 'pid:'+process.pid)
var async = require('async')
var Code = require('../../../util/code')
var Utils = require('../../../util/utils')
var frontChannelService = require('../../../modules/frontChannel')

module.exports = function(app) {
	return new Handler(app)
}

var Handler = function(app) {
    this.app = app
}

var handler = Handler.prototype

handler.login = function(req, session, next) {
    if (!session.isValid()) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    var self = this
    if (!req.userId || !req.channelId || !req.token) {
        next(null, {
            code: Code.BAD_REQUEST
        });
        session.closed('bad request')
        return
    }

    var userId = req.userId,
        channelId = req.channelId,
        code = Code.INTERNAL_SERVER_ERROR,
        retData, userRole, userData
    var uId = Utils.getSessionUid(userId, channelId)
    var remote = session.getClientAddress()

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
            self.app.rpc.auth.authRemote.verifyToken(session, req.token, userId, channelId, cb, 1)
        },
        function(ret, role, data, cb) {
            cb = arguments[arguments.length-1]
            code = ret
            if (code !== Code.SUCC) {
                cb(new Error('authRemote.verifyToken fail'))
            }
            else {
                userRole = role
                userData = data
                cb(null)
            }
        },
        function(cb) {
            if (!session.isValid()) {
                cb(new Error('session invalid sid='+session.id))
            }
            else {
                session.on('closed', onUserLeave.bind(null, self.app))
                session.set('userId', userId)
                session.set('channelId', channelId)
                session.set('context', context)
                session.pushAll()
                session.bind(uId, function(err) {
                    if (!!err) {
                        code = Code.DUPLICATED_LOGIN
                    }
                    cb(err)
                })
            }
        },
        function(cb) {
            if (!session.isValid()) {
                cb(new Error('session invalid sid='+session.id))
            }
            else {
                self.app.rpc.channel.channelRemote.enter(session, userId, channelId, userRole, userData, context, cb, 2)
            }
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
            logger.warn("login error userId=%s channelId=%s token=%s code=%s err=%s stack=%s", userId, channelId, req.token, code, err.toString(), err.stack)
            if (session.isValid()) {
                next(null, {
                    code: code
                })
                session.closed('login error')
            }
        }
        else {
            frontChannelService.add(channelId, retData.roomId, session.id)
            logger.info('login succ userId=%s channelId=%s token=%s', userId, channelId, req.token)
            next(null, {
                code: Code.SUCC,
                data: {
                    user: userData
                }
            })
        }
    })
}

var onUserLeave = function(app, session, reason) {
    if (!session || !session.get('userId') || reason === 'kick' || reason === 'login error') {
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

    app.rpc.channel.channelRemote.leave.toServer('*', userId, channelId, context, function(err, code){
        if (!!err || code !== Code.SUCC) {
            logger.warn('onUserLeave fail userId=%s channelId=%s roomId=%s context=%j reason=%s err=%s code=%s', userId, channelId, roomId, context, reason, err, code)
        }
        else {
            logger.info('onUserLeave succ userId=%s channelId=%s roomId=%s context=%j reason=%s code=%s', userId, channelId, roomId, context, reason, code)   
        }
    }, 2)
}

var leaveMsgs = []
var leaveLoopStarted = false

var onUserLeaveBatch = function(app, session, reason) {
    if (!session || !session.get('userId') || reason === 'kick' || reason === 'login error') {
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

    leaveMsgs.push({
        channelId: channelId,
        userId: userId,
        context: context,
        roomId: roomId
    })

    if (!leaveLoopStarted) {
        setInterval(sendLeaveMsgBatch.bind(null, app), 1000)
        leaveLoopStarted = true
    }
}

var sendLeaveMsgBatch = function(app) {
    if (leaveMsgs.length > 0) {
        var msgs = leaveMsgs
        leaveMsgs = []
        app.rpc.channel.channelRemote.leaveBatch.toServer('*', msgs, function(err, code, failed){
            if (!!failed && failed.length > 0) {
                logger.warn('leave batch failed=%j', failed)
            }
        }, 2)
    }
}