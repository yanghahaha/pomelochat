var Code = require('../util/code')
var config = require('../util/config')

module.exports = function(app, serverType) {
    return new Filter(app, serverType)
}

var Filter = function(app, serverType) {
    this.app = app
    this.logger = require('pomelo-logger').getLogger(serverType, __filename, process.pid)
}

Filter.prototype.before = function(msg, session, next) {
    session.__startTime__ = Date.now()
    next()
}

Filter.prototype.after = function(err, msg, session, resp, next) {
    var start = session.__startTime__
    var timeUsed = -1
    if (typeof start === 'number') {
        timeUsed = Date.now() - start
    }

    var code = (resp === undefined) ? undefined : resp.code
    var log = {
      route: msg.__route__,
      req: msg,
      res: resp,
      remote: this.app.sessionService.getClientAddressBySessionId(session.id),
      timeUsed: timeUsed,
      code: code
    }

    if (!!err) {
        this.logger.error('%s err=%s', JSON.stringify(log), err.stack)
    }
    else if(resp.code !== Code.SUCC) {
        this.logger.error(JSON.stringify(log))
    }
    else if (timeUsed > config.get('handler.timeUseWarn')) {
        this.logger.warn(JSON.stringify(log))
    }
    else {
        this.logger.debug(JSON.stringify(log))
    }

    next(err)
}
