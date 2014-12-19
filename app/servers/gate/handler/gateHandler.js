var _ = require('underscore')
var Code = require('../../../util/code')

module.exports = function(app) {
	return new Handler(app)
}

var Handler = function(app) {
	this.app = app
}

var handler = Handler.prototype

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
    var app = this.app

	if (_.isUndefined(req.userId) || _.isUndefined(req.channelId)) {
		next(null, {
			code: Code.BAD_REQUEST
		})
        app.sessionService.kickBySessionId(session.id)
		return
	}

	var connectors = this.app.getServersByType('connector')
	if(!connectors || connectors.length === 0) {
		next(null, {
			code: Code.INTERNAL_SERVER_ERROR
		})
        app.sessionService.kickBySessionId(session.id)
		return
	}

    var res = dispatch(req.userId, connectors)
    next(null, {
        code: Code.SUCC,
        host: res.clientHostReal,
        port: res.clientPort
    })             
    app.sessionService.kickBySessionId(session.id)
}

var dispatch = function(key, list) {
	var index = (Math.random() * 10000 | 0)% list.length
	return list[index]
}
