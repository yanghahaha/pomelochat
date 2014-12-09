var _ = require('underscore');
var logger = require('pomelo-logger').getLogger('gate', __filename, process.pid);
var Code = require('../../../util/code');
var Utils = require('../../../util/utils.js');

module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

var handler = Handler.prototype;

/*
req = {
	userId: xxx,
	channelId: xxxx
}
res = {
	code:
	host:
	port:
}
*/
handler.lookupConnector = function(req, session, next) {
    var app = this.app;

	if (_.isUndefined(req.userId) || _.isUndefined(req.channelId)) {
		next(null, {
			code: Code.BAD_REQUEST
		});
        app.sessionService.kickBySessionId(session.id);
		return;
	}

	var connectors = this.app.getServersByType('connector');
	if(!connectors || connectors.length === 0) {
		next(null, {
			code: Code.INTERNAL_SERVER_ERROR
		});
        app.sessionService.kickBySessionId(session.id);
		return;
	}

    var res = dispatch(Utils.getSessionUid(req.userId, req.channelId), connectors);
    applyToken(app, session, req.userId, req.channelId, function(err, code, token){
        if (code != Code.SUCC) {
            next(null, {
                code: code
            });
        }
        else {
            next(null, {
                code: Code.SUCC,
                host: res.host,
                port: res.clientPort,
                token: token
            });             
        }
        //app.sessionService.kickBySessionId(session.id);
    });

/*	var res = dispatch(Utils.getSessionUid(req.userId, req.channelId), connectors);
	next(null, {
		code: Code.SUCC,
		host: res.host,
		port: res.clientPort
	});
    app.sessionService.kickBySessionId(session.id);
*/};

var crc = require('crc');
var dispatch = function(key, list) {
	var index = Math.abs(crc.crc32(key)) % list.length;
	return list[index];
};

var applyToken = function(app, session, userId, channelId, cb) {
    app.rpc.auth.authRemote.applyToken(session, userId, channelId, {
        base: {
            name: 'bob',
            level: 1    
        },
        channel: {
            role: 'user'
        }
    }, cb);
};