var test = function(label, dispatcher) {
    console.log('========================= Test %s', label)
    var servers = [
        {id: 1},
        {id: 2},
        {id: 3}
    ]

    var result = {}
    for (var i=0; i<10000; ++i) {
        var server = dispatcher.dispatch(servers)
        if (!result[server.id]) {
            result[server.id] = 1
        }
        else {
            result[server.id]++
        }
    }
    console.log(result)

    servers.push({id: 4})
    for (var i=0; i<10000; ++i) {
        var server = dispatcher.dispatch(servers)
        if (!result[server.id]) {
            result[server.id] = 1
        }
        else {
            result[server.id]++
        }
    }
    console.log(result)
}

test('randomDispatcher', require('../../app/dispatchers/randomDispatcher'))
test('roundRobinDispatcher', require('../../app/dispatchers/roundRobinDispatcher'))

var leastConnDispatcher = require('../../app/dispatchers/leastConnDispatcher')
leastConnDispatcher.init(null, {
    1: 0,
    2: 0,
    3: 0,
    4: 0
})
test('leastConnDispatcher', leastConnDispatcher)