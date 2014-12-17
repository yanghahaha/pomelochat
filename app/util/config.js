module.exports = {

    LOGIN: {
        TOKEN_TIMEOUT               : 30
    },

    CHANNEL: {
        USER_MAX_CHANNEL            : 10,
        CHANNEL_MAX_USER            : 1 << 30,  // 单个频道总用户数限制
        CHANNEL_MAX_CONNECTION      : 1 << 30,  // 单个频道总连接数限制
        CHANNEL_MAX_USER_CONNECTION : 5,        // 单个频道单个用户最多连接数, 考虑到同时多个设备
        ROOM_MAX_USER               : 5000,     // 单个房间最大人数，注意是人数，同个用户的多个设备进入的会是一个房间，保证看的内容一致
    }

}