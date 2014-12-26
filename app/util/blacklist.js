var fs = require('fs')
var exp = module.exports

var CONFIG_PATH = '../../config/blacklist.json'
var CHECK_SEC = 1

var config,
    path,
    mtime,
    app

exp.init = function(application, opts) {
    opts = opts || {}
    app = application
    path = opts.path || CONFIG_PATH
    var checkSec = opts.checkSec || CHECK_SEC

    mtime = fs.statSync(path).mtime.getTime()
    config = JSON.parse(fs.readFileSync(path))
    config = parse(config)

    console.log('load blacklist file %s mtime=%s for %s %s', path, mtime, app.getServerType(), app.get('env'))
    console.log(config)

    setInterval(check, checkSec*1000)
}

exp.get = function(cb) {
    cb(null, config)
}

var check = function() {
    fs.stat(path, function(err, stats){
        if (!!err) {
            console.error('stat blacklist file %s fail err=%s', path, err.stack)
        }
        else {
            var nowMTime = stats.mtime.getTime()
            if (nowMTime !== mtime) {
                mtime = nowMTime
                reload()
            }
        }
    })
}

var reload = function() {
    fs.readFile(path, function(err, data) {
        if (!!err) {
            console.error('read blacklist file %s fail err=%j', path, err)
        }
        else {
            try {
                config = JSON.parse(data)
                config = parse(config)
                console.log('reload blacklist file %s mtime=%s for %s %s', path, mtime, app.getServerType(), app.get('env'))
                console.log(config)
            }
            catch (e) {
                console.error('reload blacklist file %s failed mtime=%s err=%s', path, mtime, e.stack)
            }
        }
    })
}

var parse = function(config) {
    config = config[app.get('env')]
    if (!config) {
        return []
    }

    config = config[app.getServerType()]
    if (!config) {
        return []
    }

    var list = []
    for (var i in config) {
        list.push('^' + config[i].replace(/\./g, '\\.'))
    }

    return list
}
