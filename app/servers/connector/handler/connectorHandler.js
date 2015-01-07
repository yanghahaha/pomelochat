var logger = require('pomelo-logger').getLogger('connector', __filename, process.pid)
var async = require('async')
var Code = require('../../../util/code')
var Utils = require('../../../util/utils')
var frontchannelService = require('../../../modules/frontChannel')

module.exports = function(app) {
	return new Handler(app)
}

var Handler = function(app) {
    this.app = app
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
        retData
    var uId = Utils.getSessionUid(userId, channelId)
    var context = {
            fId: self.app.get('serverId'),
            sId: session.id,
            remote: self.app.sessionService.getClientAddressBySessionId(session.id)
        }

    async.waterfall([
        function(cb) {
            session.bind(uId, function(err) {
                if (!!err) {
                    code = Code.DUPLICATED_LOGIN
                }
                cb(err)
            })
        },
        function(cb) {
            self.app.rpc.api.channelRemote.enter(session, req.token, userId, channelId, context, cb)
        },
        function(ret, data, cb) {
            cb = arguments[arguments.length-1]
            code = ret
            if (code !== Code.SUCC) {
                cb(new Error('channelRemote.enter fail'))
            }
            else {
                retData = data
                session.on('closed', onUserLeave.bind(null, self.app))
                session.set('userId', userId)
                session.set('channelId', channelId)
                session.set('context', context)
                session.set('roomId', retData.roomId)
                session.pushAll(cb)
            }
        }
    ], function(err) {
        if (!!err) {
            logger.error("login error userId=%s channelId=%s token=%s code=%s err=%j", userId, channelId, req.token, code, err)
            next(null, {
                code: code
            })
            self.app.sessionService.kickBySessionId(session.id)
        }
        else {
            frontchannelService.add(channelId, retData.roomId, session.id)
            logger.debug('login succ userId=%s channelId=%s token=%s', userId, channelId, req.token)
            next(null, {
                code: Code.SUCC,
                data: retData
            })
        }
    })
}

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

    frontchannelService.remove(channelId, roomId, session.id)
    app.rpc.api.channelRemote.leave(session, userId, channelId, context, function(err, code){
        if (!!err || code !== Code.SUCC) {
            logger.debug('leave error userId=%s channelId=%s reason=%s code=%s error=%j', userId, channelId, reason, code, err)
        }
        else {
            logger.debug('leave succ userId=%s channelId=%s reason=%s', userId, channelId, reason)
        }
    })
}
