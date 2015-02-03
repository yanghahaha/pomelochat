var _ = require('underscore')
var Code = require('../../../util/code')
//var logger = require('pomelo-logger').getLogger('api', __filename, 'pid:'+process.pid)
var channelRemote

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    channelRemote = app.rpc.channel.channelRemote
    setInterval(sendMsgCount.bind(null, app), 1000)
};

var handler = Handler.prototype;

handler.applyToken = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    this.app.rpc.auth.authRemote.applyToken(req, req.userId, req.channelId, req.userData,  function(err, code, token){
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
    var connectors = []
    _.each(app.getServersByType('connector'), function(connector){
        connectors.push(connector.id)
    })
    return connectors
}

/**************************************************
    send msg
***************************************************/
handler.sendServerMsg = function(req, session, next) {
    if (!req.route) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }
    next(null, {code: Code.SUCC})

    this.app.rpc.connector.connectorRemote.sendServerMsg.toServer('*', req.route, req.msg, null)
}

handler.sendChannelMsg = function(req, session, next) {
    if (!req.route || !req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }
    next(null, {code: Code.SUCC})

    var channelIds
    if (_.isArray(req.channelId)) {
        channelIds = req.channelId
    }
    else {
        channelIds = [req.channelId]
    }

    var connectors = routeConnectors(this.app, {
        channelIds: channelIds
    })

    for (var i=0; i<connectors.length; ++i) {
        this.app.rpc.connector.connectorRemote.sendChannelMsg.toServer(connectors[i], channelIds, req.route, req.msg, null)
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

    var roomIds
    if (_.isArray(req.roomId)) {
        roomIds = req.roomId
    }
    else {
        roomIds = [req.roomId]
    }

    var routeParams = {
        channelIds: [req.channelId],
        roomIds: {}
    }
    routeParams.roomIds[req.channelId] = roomIds

    logMsgCount(req.channelId, roomIds, 1)

    var connectors = routeConnectors(this.app, routeParams)
    for (var i=0; i<connectors.length; ++i) {
        this.app.rpc.connector.connectorRemote.sendRoomMsg.toServer(connectors[i], req.channelId, roomIds, req.route, req.msg, null)
    }
}

handler.sendRoomMsgByUserId = function(req, session, next) {
    if (!req.route || !req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })   
        return
    }
    var self = this
    channelRemote.getRoomIdByUserId(req, req.channelId, req.userId, function(err, code, roomId){
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
            self.sendRoomMsg(req, session, next)
        }
    })
}

handler.kickUser = function(req, session, next) {
    if (!req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })   
        return
    }

    var app = this.app
    channelRemote.kickUser(req, req.userId, req.channelId, function(err, code, contexts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code
            })

            if (code === Code.SUCC && !!contexts && !_.isEmpty(contexts)) {
                kickContexts(app, contexts, req.route, req.msg)
            }
        }
    })
}

handler.kickIp = function(req, session, next) {
    if (!req.ip) {
        next(null, {
            code: Code.BAD_REQUEST
        })   
        return
    }

    var app = this.app
    channelRemote.kickIp(req, req.ip, function(err, code, contexts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code
            })

            if (code === Code.SUCC && !!contexts && !_.isEmpty(contexts)) {
                kickContexts(app, contexts, req.route, req.msg)
            }            
        }
    })
}


var kickContexts = function(app, channelToContexts, route, msg) {
/*
ret = {
    channelId1: {
        roomId1: [{
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
            roomId1: [sId1, sId2, ...]
        }
        channelId2: {...}
    }
    fId2: {...}
}
*/
    var sIdToKickData = {}

    _.each(channelToContexts, function(rooms, channelId){
        _.each(rooms, function(ctxs, roomId){
            _.each(ctxs, function(context){

                var fId = context.fId,
                    sId = context.sId

                if (!sIdToKickData[fId]) {
                    sIdToKickData[fId] = {}
                }
                if (!sIdToKickData[fId][channelId]) {
                    sIdToKickData[fId][channelId] = {}
                }
                if (!sIdToKickData[fId][channelId][roomId]) {
                    sIdToKickData[fId][channelId][roomId] = []
                }

                sIdToKickData[fId][channelId][roomId].push(sId)
            })
        })
    })

    for (var fsId in sIdToKickData) {
        app.rpc.connector.connectorRemote.kick.toServer(fsId, sIdToKickData[fsId], route, msg, null)
    }
}


/**************************************************
    get user count
***************************************************/
handler.getServerUserCount = function(req, session, next) {
    channelRemote.getServerUserCount(req, function(err, code, userCount, connectionCount){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                userCount: userCount,
                connectionCount: connectionCount
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

    channelRemote.getChannelUserCount(req, req.channelId, function(err, code, counts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code,
                channels: counts
            })              
        }
    })
}

handler.getAllChannelUserCount = function(req, session, next) {
    channelRemote.getAllChannelUserCount(req, function(err, code, counts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })
        }
        else {
            next(null, {
                code: code,
                channels: counts
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

    channelRemote.getRoomUserCount(req, req.channelId, req.roomId, function(err, code, counts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                rooms: counts
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

    channelRemote.getRoomUserCountByUserId(req, req.channelId, req.userId, function(err, code, userCount, connectionCount){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                userCount: userCount,
                connectionCount: connectionCount
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

    channelRemote.getChannelUsers(req, req.channelId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
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

    channelRemote.getRoomUsers(req, req.channelId, req.roomId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
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

    channelRemote.getRoomUsersByUserId(req, req.channelId, req.userId, req.dataKeys, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                users: users
            })              
        }
    })
}

/**************************************************
    dump
***************************************************/
handler.dumpUser = function(req, session, next) {
    if (!req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    channelRemote.dumpUser(req, req.userId, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                users: users
            })              
        }
    })
}

handler.dumpAllUser = function(req, session, next) {
    channelRemote.dumpAllUser(req, function(err, code, users){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                users: users
            })              
        }
    })
}

handler.dumpChannel = function(req, session, next) {
    if (!req.channelId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
        return
    }

    channelRemote.dumpChannel(req, req.channelId, function(err, code, channels){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                channels: channels
            })              
        }
    })
}

handler.dumpAllChannel = function(req, session, next) {
    channelRemote.dumpAllChannel(req, function(err, code, channels){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                channels: channels
            })              
        }
    })
}

var roomMsgCount = {}

var logMsgCount = function(channelId, roomIds, msgCount) {
    if (!roomMsgCount[channelId]) {
        roomMsgCount[channelId] = {}
    }

    _.each(roomIds, function(roomId){
        if (!roomMsgCount[channelId][roomId]) {
            roomMsgCount[channelId][roomId] = msgCount
        }
        else {
            roomMsgCount[channelId][roomId] += msgCount   
        }
    })
}

var sendMsgCount = function(app) {
    if (_.isEmpty(roomMsgCount)) {
        return
    }

    var msgCountSent = roomMsgCount
    roomMsgCount = {}
    app.rpc.channel.channelRemote.logMsgCountBatch.toServer('*', null, msgCountSent, null)
}

/**************************************************
    top & sort
***************************************************/
handler.topChannels = function(req, session, next) {
    channelRemote.topChannels(req, req.topNum, function(err, code, channels){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                channels: channels
            })              
        }
    })
}

handler.topIps = function(req, session, next) {
    channelRemote.topIps(req, req.topNum, function(err, code, ips){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                ips: ips
            })              
        }
    })
}

handler.sortIps = function(req, session, next) {
    channelRemote.sortIps(req, req.minCount, function(err, code, ips){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                ips: ips
            })
        }
    })
}

/**************************************************
    stats
***************************************************/
handler.getServerStats = function(req, session, next) {
    channelRemote.getServerStats(req, function(err, code, stats){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            next(null, {
                code: code,
                stats: stats
            })
        }
    })
}