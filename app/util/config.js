var fs = require('fs')
var exp = module.exports

var CONFIG_PATH = '../../config/config.json'
var CHECK_SEC = 1

var config,
    path,
    mtime

exp.init = function(opts) {
    opts = opts || {}
    path = opts.path || CONFIG_PATH
    var checkSec = opts.checkSec || CHECK_SEC

    config = JSON.parse(fs.readFileSync(path))
    mtime = fs.statSync(path).mtime.getTime()

    console.log('load config file %s mtime=%s', path, mtime)
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
            console.error('read config file %s fail err=%j', path, err)
        }
        else {
            try {
                config = JSON.parse(data)
                console.log('reload config file %s mtime=%s', path, mtime)
                console.log(config)
            }
            catch (e) {
                console.error('reload config file %s failed mtime=%s err=%s', path, mtime, e.stack)
            }
        }
    })
}
