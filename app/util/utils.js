var utils = module.exports;

utils.getSessionUid = function(userId, channelId) {
    return userId + '-' + channelId;
};