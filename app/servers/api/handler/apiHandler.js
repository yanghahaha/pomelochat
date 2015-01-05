var _ = require('underscore')
var Code = require('../../../util/code')
var channelRemote

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
    channelRemote = require('../remote/channelRemote')(app)
};

var handler = Handler.prototype;

handler.applyToken = function(req, session, next) {
    if (!req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })
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

var routeConnectors = function(app, params) {
    if (!routeConnectors.allConnectors) {
        routeConnectors.allConnectors = []
        _.each(app.getServersByType('connector'), function(connector){
            routeConnectors.allConnectors.push(connector.id)
        })
    }
    return routeConnectors.allConnectors
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

    var time = new Date().getTime() / 1000 | 0
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

    var connectors = routeConnectors(this.app, routeParams)
    for (var i=0; i<connectors.length; ++i) {
        this.app.rpc.connector.connectorRemote.sendRoomMsg.toServer(connectors[i], req.channelId, roomIds, req.route, req.msg, null)
    }

    var time = new Date().getTime() / 1000 | 0
    channelRemote.logMsgCount(req.channelId, roomIds, time, 1, null)
}

handler.sendRoomMsgByUserId = function(req, session, next) {
    if (!req.route || !req.channelId || !req.userId) {
        next(null, {
            code: Code.BAD_REQUEST
        })   
        return
    }
    var self = this
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

    var channelToContexts
    channelRemote.kick(req.userId, req.channelId, function(err, code, contexts){
        if (!!err) {
            next(null, {
                code: Code.INTERNAL_SERVER_ERROR
            })            
        }
        else {
            channelToContexts = contexts
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
    if (!_.isEmpty(channelToContexts)) {
        var sIdToKickData = {}

        _.each(channelToContexts, function(info, channelId){
            if (!!info) {
                var roomId = info.roomId
                var contexts = info.contexts                

                _.each(contexts, function(context){
                    var fId = context.fId,
                        sId = context.sId

                    if (!sIdToKickData[fId]) {
                        sIdToKickData[fId] = {}
                    }
                    if (!sIdToKickData[fId][channelId]) {
                        sIdToKickData[fId][channelId] = {
                            roomId: roomId,
                            sIds: []
                        }
                    }
                    sIdToKickData[fId][channelId].sIds.push(sId)
                })
            }
        }) 

        // for (var channelId in channelToContexts) {
        //     if (!channelToContexts[channelId]) {
        //         continue
        //     }

        //     var info = channelToContexts[channelId]
        //     var roomId = info.roomId
        //     var contexts = info.contexts


        //     for (var i=0; i<contexts.length; ++i) {

        //         var fId = contexts[i].fId,
        //             sId = contexts[i].sId

        //         if (!sIdToKickData[fId]) {
        //             sIdToKickData[fId] = {}
        //         }
        //         if (!sIdToKickData[fId][channelId]) {
        //             sIdToKickData[fId][channelId] = {
        //                 roomId: roomId,
        //                 sIds: []
        //             }
        //         }
        //         sIdToKickData[fId][channelId].sIds.push(sId)
        //     }
        // }

        for (var fsId in sIdToKickData) {
            this.app.rpc.connector.connectorRemote.kick.toServer(fsId, sIdToKickData[fsId], req.route, req.msg, null)
        }
    }
}

/**************************************************
    get user count
***************************************************/
handler.getServerUserCount = function(req, session, next) {
    channelRemote.getServerUserCount(function(err, code, userCount, connectionCount){
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

    channelRemote.getChannelUserCount(req.channelId, function(err, code, counts){
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

    channelRemote.getRoomUserCount(req.channelId, req.roomId, function(err, code, counts){
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

    channelRemote.getRoomUserCountByUserId(req.channelId, req.userId, function(err, code, userCount, connectionCount){
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

    channelRemote.getChannelUsers(req.channelId, req.dataKeys, function(err, code, users){
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

    channelRemote.getRoomUsers(req.channelId, req.roomId, req.dataKeys, function(err, code, users){
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

    channelRemote.getRoomUsersByUserId(req.channelId, req.userId, req.dataKeys, function(err, code, users){
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

    channelRemote.dumpUser(req.userId, function(err, code, users){
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
    channelRemote.dumpAllUser(function(err, code, users){
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

    channelRemote.dumpChannel(req.channelId, function(err, code, channels){
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
    channelRemote.dumpAllChannel(function(err, code, channels){
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
