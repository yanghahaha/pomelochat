var fs = require('fs')
var exp = module.exports

var CONFIG_PATH = '../../config/config.json'
var CHECK_SEC = 1

var config,
    path,
    mtime,
    env

exp.init = function(environment, opts) {
    env = environment
    opts = opts || {}
    path = opts.path || CONFIG_PATH
    var checkSec = opts.checkSec || CHECK_SEC

    mtime = fs.statSync(path).mtime.getTime()
    config = JSON.parse(fs.readFileSync(path))
    config = config[env]
    if (!config) {
        throw new Error('load config file '+ path + ' failed env=' + env)
    }

    console.log('load config file %s mtime=%s env=%s', path, mtime, env)
    console.log(config)

    setInterval(check, checkSec*1000)
}

exp.get = function(property) {
    return config[property]
}

var check = function() {
    fs.stat(path, function(err, stats){
        if (!!err) {
            console.error('stat config file %s fail err=%s', path, err.stack)
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
            console.error('read config file %s fail err=%s', path, err.stack)
        }
        else {
            try {
                config = JSON.parse(data)

                console.log('reload config file %s mtime=%s env=%s', path, mtime, env)
                console.log(config)
            }
            catch (e) {
                console.error('reload config file %s failed mtime=%s env=%s err=%s', path, mtime, env, e.stack)
            }
        }
    })
}
