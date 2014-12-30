var counter = 0

module.exports.dispatch = function(servers) {
    var index = counter++ % servers.length
    return servers[index]
}
