module.exports.dispatch = function(servers) {
    var index = (Math.random() * 10000 | 0) % servers.length
    return servers[index]
}
