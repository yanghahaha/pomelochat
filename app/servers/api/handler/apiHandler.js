var Code = require('../util/code')
var Consts = require('../util/consts')

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.applyToken = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, Code.BAD_REQUEST)   
        return
    }

    this.app.rpc.auth.authRemote.applyToken(session, req.userId, req.channelId, req.userData,  function(err, code, token){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code,
                token: token
            })
        }
    })
}

handler.sendServerMsg = function(msg, next) {
    this.app.get('channelService').broadcast(Consts.USER_FRONT_SERVER, Consts.SENT_MSG_ROUTE, msg, {
        binded: true
    }, function(err){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: Code.SUCC
            })
        }
    })
}

handler.sendChannelMsg = function(req, session, next) {
    if (!req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    this.app.rpc.channel.channelRemote.sendChannelMsg(session, req.channelId, req.msg, function(err, code){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code
            })
        }
    })
}

handler.sendRoomMsg = function(req, session, next) {
    if (!req.channelId || !req.roomId) {
        next(null, Code.BAD_REQUEST)   
        return
    }

    this.app.rpc.channel.channelRemote.sendRoomMsg(session, req.channelId, req.roomId, req.msg, function(err, code){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code
            })
        }
    })    
}

handler.sendRoomMsgByUserId = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, Code.BAD_REQUEST)   
        return
    }

    this.app.rpc.channel.channelRemote.sendRoomMsgByUserId(session, req.channelId, req.userId, req.msg, function(err, code){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code
            })
        }
    })    
}

handler.kickUser = function(req, session, next) {
    
}

handler.getUserCount = function(req, session, next) {

}

handler.getUsers = function(req, session, next) {

}