var fs = require('fs')
var exp = module.exports

var CONFIG_PATH = '../../config/blacklist.json'
var CHECK_SEC = 1

var config,
    path,
    mtime,
    env,
    serverType

exp.init = function(environment, serverTypeParam, opts) {
    env = environment
    serverType = serverTypeParam
    opts = opts || {}
    path = opts.path || CONFIG_PATH
    var checkSec = opts.checkSec || CHECK_SEC

    mtime = fs.statSync(path).mtime.getTime()
    config = JSON.parse(fs.readFileSync(path))
    config = parse(config)

    console.log('load blacklist file %s mtime=%s env=%s serverType=%s', path, mtime, env, serverType)
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
            console.error('read blacklist file %s fail err=%s', path, err.stack)
        }
        else {
            try {
                config = JSON.parse(data)
                config = parse(config)
                console.log('reload blacklist file %s mtime=%s env=%s serverType=%s', path, mtime, env, serverType)
                console.log(config)
            }
            catch (e) {
                console.error('reload blacklist file %s failed mtime=%s err=%s', path, mtime, e.stack)
            }
        }
    })
}

var parse = function(config) {
    config = config[env]
    if (!config) {
        return []
    }

    config = config[serverType]
    if (!config) {
        return []
    }

    var list = []
    for (var i in config) {
        list.push('^' + config[i].replace(/\./g, '\\.'))
    }

    return list
}
