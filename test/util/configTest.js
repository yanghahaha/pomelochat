var config = require('../../app/util/config')

console.log(config)
config.init()

setInterval(function(){
    console.log('ROOM_MAX_USER=%s', config.get('ROOM_MAX_USER'))
}, 1000)