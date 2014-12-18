var Code = require('../../../util/code')
var channelRemote = require('../remote/channelRemote')

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

    channelRemote.applyToken(req.userId, req.channelId, req.userData,  function(err, code, token){
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

var routeConnectors = function(app) {
    return app.getServersByType('connector')
}

/**************************************************
    send msg
***************************************************/
handler.broadcastMsg = function(req, session, next) {
    if (!req.route) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }
    next(null, {code: Code.SUCC})

    this.app.rpc.connector.connectorRemote.broadcastMsg.toServer('*', req.route, req.msg, null)
}

handler.sendChannelMsg = function(req, session, next) {
    if (!req.route || !req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }
    next(null, {code: Code.SUCC})

    var connectors = routeConnectors(this.app, {channelId: req.channelId})
    for (var i=0; i<connectors.length; ++i) {
        this.app.rpc.connector.connectorRemote.sendChannelMsg.toServer(connectors[i], req.channelId, req.route, req.msg, null)
    }
}

handler.sendRoomMsg = function(req, session, next) {
    if (!req.route || !req.channelId || !req.roomId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }
    next(null, {code: Code.SUCC})

    var connectors = routeConnectors(this.app, {channelId: req.channelId})
    for (var i=0; i<connectors.length; ++i) {
        this.app.rpc.connector.connectorRemote.sendRoomMsg.toServer(connectors[i], req.channelId, req.roomId, req.route, req.msg, null)
    }
}

handler.sendRoomMsgByUserId = function(req, session, next) {
    if (!req.route || !req.channelId || !req.userId) {
        next(null, Code.BAD_REQUEST)   
        return
    }

    channelRemote.getRoomIdByUserId(req.channelId, req.userId, function(err, code, roomId){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else if (code !== Code.SUCC) {
            next(null, {
                code: code
            })                   
        }
        else {
            req.roomId = roomId
            this.sendRoomMsg(req, session, next)
        }
    })
}

handler.kickUser = function(req, session, next) {
    if (!req.userId) {
        next(null, Code.BAD_REQUEST)   
        return
    }
    channelRemote.kick(req.uesrId, req.channelId, function(err, code, channelToContexts){
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

/*
ret = {
    channelId1: {
        roomId: roomId
        contexts: [{
            fId:
            sId:
            context:
        }]
    },
    channelId2: {...}
}
To
sIdToKickData = {
    fId1: {
        channelId1: {
            roomId: roomId
            sIds: [sId1, sId2, ...]
        }
        channelId2: {...}
    }
    fId2: {...}
}
*/
    var sIdToKickData = {}
    for (var channelId in channelToContexts) {
        var info = channelToContexts[channelId]
        var roomId = info.roomId
        var contexts = info.contexts
        for (var i=0; i<contexts.length; ++i) {

            var fId = contexts[i].fId
                sId = contexts[i].sId

            if (!sIdToKickData[fId]) {
                sIdToKickData[fId] = {}
            }
            if (!sIdToKickData[fId][channelId]) {
                sIdToKickData[fId][channelId] = {
                    roomId: roomId
                    sIds: []
                }
            }
            sIdToKickData[fId][channelId]['sIds'].push(sId)
        }
    }

    for (var fsId in sIdToKickData) {
        this.app.rpc.connector.connectorRemote.kick.toServer(fsId, sIdToKickData[fsId], null)
    }
}

/**************************************************
    get user count
***************************************************/
handler.getServerUserCount = function(req, session, next) {
    channelRemote.getServerUserCount(function(err, count){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                count: count
            })              
        }
    })
}

handler.getChannelUserCount = function(req, session, next) {
    if (!req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getChannelUserCount(req.channelId, function(err, count){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                count: count
            })              
        }
    })
}

handler.getRoomUserCount = function(req, session, next) {
    if (!req.channelId || !req.roomId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getRoomUserCount(req.channelId, req.roomId, function(err, count){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                count: count
            })              
        }
    })
}

handler.getRoomUserCountByUserId = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getRoomUserCountByUserId(req.channelId, req.userId, function(err, count){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                count: count
            })              
        }
    })
}

/**************************************************
    get user list
***************************************************/
handler.getChannelUsers = function(req, session, next) {
    if (!req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getChannelUsers(req.channelId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                users: users
            })              
        }        
    })
}

handler.getRoomUsers = function(req, session, next) {
    if (!req.channelId || !req.roomId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getRoomUsers(req.channelId, req.roomId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                users: users
            })              
        }
    })
}

handler.getRoomUsersByUserId = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }   

    channelRemote.getRoomUsersByUserId(req.channelId, req.userId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                users: users
            })              
        }
    })
}

/**************************************************
    dump
***************************************************/
handler.dumpUser = function(req, session, next) {
    if (!!req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    channelRemote.dumpUser(req.userId, function(err, code, user){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                user: user
            })              
        }
    })
}

handler.dumpUsers = function(req, session, next) {
    channelRemote.dumpUsers(function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                users: users
            })              
        }
    })
}

handler.dumpChannel = function(req, session, next) {
    if (!!req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    channelRemote.dumpChannel(req.channelId, function(err, code, channel){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                channel: channel
            })              
        }
    })
}

handler.dumpChannels = function(req, session, next) {
    channelRemote.dumpChannels(function(err, code, channels){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: Code.SUCC,
                channels: channels
            })              
        }
    })
}
