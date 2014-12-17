var utils = module.exports;

utils.invokeCallback = function(cb) {
    if ( !! cb && typeof cb === 'function') {
        cb.apply(null, Array.prototype.slice.call(arguments, 1))
    }
}

utils.getSessionUid = function(userId, channelId) {
    return userId + '-' + channelId;
}
