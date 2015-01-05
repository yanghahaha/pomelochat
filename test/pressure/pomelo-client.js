var EventEmitter = require('events').EventEmitter
var util = require('util')
var WebSocket = require('ws')
var Protocol = require('pomelo-protocol')
var Package = Protocol.Package
var Message = Protocol.Message

var JS_WS_CLIENT_TYPE = 'js-websocket'
var JS_WS_CLIENT_VERSION = '0.0.1'

var RES_OK = 200
var RES_OLD_CLIENT = 501


var Client = function() {
    this.init()
}
util.inherits(Client, EventEmitter)

module.exports = Client

Client.prototype.init = function() {
    this.socket = null
    this.reqId = 0
    this.callbacks = {}
    this.routeMap = {}

    this.heartbeatInterval = 0
    this.heartbeatTimeout = 0
    this.nextHeartbeatTimeout = 0
    this.gapThreshold = 100   // heartbeat gap threashold
    this.heartbeatId = null
    this.heartbeatTimeoutId = null

    this.handshakeCallback = null

    this.handshakeBuffer = {
        'sys': {
            type: JS_WS_CLIENT_TYPE,
            version: JS_WS_CLIENT_VERSION
        },
        'user': {
        }
    }

    this.initCallback = null
    this.messageProcessor = null    
}

Client.prototype.setMessageProcessor = function(processor) {
    this.messageProcessor = processor
}

Client.prototype.connect = function(params, cb) {
    this.initCallback = cb
    this.handshakeBuffer.user = params.user;
    this.handshakeCallback = params.handshakeCallback

    var host = params.host
    var port = params.port
    var url = 'ws://' + host
    if(port) {
        url +=  ':' + port
    }
    this.initWebSocket(url, cb)
}

Client.prototype.disconnect = function() {
    if (!!this.socket) {
        if (!!this.socket.disconnect) {
            this.socket.disconnect()
        }
        if(!!this.socket.close) {
            this.socket.close()
        }
        this.socket = null
    }

    if (this.heartbeatId) {
        clearTimeout(this.heartbeatId)
    }
    if (this.heartbeatTimeoutId) {
        clearTimeout(this.heartbeatTimeoutId)
    }

    this.init()
}

Client.prototype.initWebSocket = function(url, cb) {
    var self = this
    var onopen = function(){
        var obj = Package.encode(Package.TYPE_HANDSHAKE, Protocol.strencode(JSON.stringify(self.handshakeBuffer)))
        self.send(obj)
    }
    var onmessage = function(event) {
        processPackage(self, Package.decode(event.data), cb)
        // new package arrived, update the heartbeat timeout
        if (!!self.heartbeatTimeout) {
            self.nextHeartbeatTimeout = Date.now() + self.heartbeatTimeout
        }
    }
    var onerror = function(event) {
        self.emit('io-error', event)
    }

    var onclose = function(event){
        self.emit('close', event)
    }

    self.socket = new WebSocket(url)
    self.socket.onopen = onopen
    self.socket.onmessage = onmessage
    self.socket.onerror = onerror
    self.socket.onclose = onclose
}

Client.prototype.request = function(route, msg, cb) {
    if(arguments.length === 2 && typeof msg === 'function') {
        cb = msg
        msg = {}
    } 
    else {
        msg = msg || {}
    }
    route = route || msg.route
    if (!route) {
        return
    }

    this.reqId++
    this.sendMessage(this.reqId, route, msg)

    this.callbacks[this.reqId] = cb
    this.routeMap[this.reqId] = route
}

Client.prototype.notify = function(route, msg) {
    msg = msg || {}
    this.sendMessage(0, route, msg)
}

Client.prototype.sendMessage = function(reqId, route, msg) {
    var type = reqId ? Message.TYPE_REQUEST : Message.TYPE_NOTIFY
    msg = Protocol.strencode(JSON.stringify(msg))

    var compressRoute = 0;
    if(this.dict && this.dict[route]){
        route = this.dict[route]
        compressRoute = 1
    }

    msg = Message.encode(reqId, type, compressRoute, route, msg)
    var packet = Package.encode(Package.TYPE_DATA, msg)
    this.send(packet)
}

Client.prototype.send = function(packet){
    this.socket.send(packet.buffer)
}


var heartbeat = function(pomelo) {
    if (!pomelo.heartbeatInterval) {
      return
    }

    var obj = Package.encode(Package.TYPE_HEARTBEAT)
    if (!!pomelo.heartbeatTimeoutId) {
        clearTimeout(pomelo.heartbeatTimeoutId)
        pomelo.heartbeatTimeoutId = null
    }

    if (!!pomelo.heartbeatId) {
      return
    }

    pomelo.heartbeatId = setTimeout(function() {
        pomelo.heartbeatId = null
        pomelo.send(obj)

        pomelo.nextHeartbeatTimeout = Date.now() + pomelo.heartbeatTimeout
        pomelo.heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb.bind(pomelo), pomelo.heartbeatTimeout)
    }, pomelo.heartbeatInterval)
}

var heartbeatTimeoutCb = function(pomelo) {
    var gap = pomelo.nextHeartbeatTimeout - Date.now()
    if (gap > pomelo.gapThreshold) {
        pomelo.heartbeatTimeoutId = setTimeout(heartbeatTimeoutCb.bind(pomelo), gap)
    }
    else {
        pomelo.emit('heartbeat timeout')
        pomelo.disconnect()
    }
}

var handshake = function(pomelo, data){
    data = JSON.parse(Protocol.strdecode(data));
    if (data.code === RES_OLD_CLIENT) {
        pomelo.emit('error', 'client version not fullfill')
        return
    }

    if (data.code !== RES_OK) {
        pomelo.emit('error', 'handshake fail')
        return
    }

    handshakeInit(pomelo, data)

    var obj = Package.encode(Package.TYPE_HANDSHAKE_ACK)
    pomelo.send(obj)

    if (pomelo.initCallback) {
        pomelo.initCallback(pomelo.socket)
        pomelo.initCallback = null
    }
}

var onData = function(pomelo, data) {
    var msg = Message.decode(data)
    if (msg.id > 0){
        msg.route = pomelo.routeMap[msg.id]
        delete pomelo.routeMap[msg.id]
        if (!msg.route) {
            return
        }
    }
    msg.body = deCompose(pomelo, msg)
    processMessage(pomelo, msg)
}

var onKick = function(pomelo) {
    pomelo.emit('onKick')
}

var handlers = {}
handlers[Package.TYPE_HANDSHAKE] = handshake
handlers[Package.TYPE_HEARTBEAT] = heartbeat
handlers[Package.TYPE_DATA] = onData
handlers[Package.TYPE_KICK] = onKick

var processPackage = function(pomelo, msg) {
    handlers[msg.type](pomelo, msg.body)
}

var processMessage = function(pomelo, msg) {
    if (!!pomelo.messageProcessor) {
        pomelo.messageProcessor(msg)
    }

    if (!msg.id) {
        pomelo.emit(msg.route, msg.body)
        return
    }

    var cb = pomelo.callbacks[msg.id]
    delete pomelo.callbacks[msg.id]

    if(typeof cb !== 'function') {
        return
    }

    cb(msg.body)
    return
}

var deCompose = function(pomelo, msg) {
    var abbrs = pomelo.data.abbrs
    var route = msg.route

    //Decompose route from dict
    if (msg.compressRoute) {
        if (!abbrs[route]){
            return {}
        }

      route = msg.route = abbrs[route]
    }

    return JSON.parse(Protocol.strdecode(msg.body))
}

var handshakeInit = function(pomelo, data) {
    if (data.sys && data.sys.heartbeat) {
        pomelo.heartbeatInterval = data.sys.heartbeat * 1000   // heartbeat interval
        pomelo.heartbeatTimeout = pomelo.heartbeatInterval * 2        // max heartbeat timeout
    } 
    else {
        pomelo.heartbeatInterval = 0
        pomelo.heartbeatTimeout = 0
    }

    initData(pomelo, data)

    if (typeof pomelo.handshakeCallback === 'function') {
        pomelo.handshakeCallback(data.user)
    }
}

  //Initilize data used in pomelo client
var initData = function(pomelo, data) {
    if(!data || !data.sys) {
        return
    }
    
    pomelo.data = pomelo.data || {}
    var dict = data.sys.dict

    //Init compress dict
    if (dict) {
        pomelo.data.dict = dict
        pomelo.data.abbrs = {}

        for(var route in dict){
            pomelo.data.abbrs[dict[route]] = route
        }
    }
}
