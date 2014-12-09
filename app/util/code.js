module.exports = {

    SUCC                                : 0,

    BAD_REQUEST                         : 400,
    UNAUTHORIZED                        : 401,

    INTERNAL_SERVER_ERROR               : 500,

    AUTH: {
        TOKEN_INVALID                   : 1001
    },

    CONNECTOR: {
        BIND_SESSION_ERROR              : 1101
    },

    ROOM: {
        USER_CHANNEL_MEET_MAX           : 1201,
        CHANNEL_USER_MEET_MAX           : 1202,
        CHANNEL_CONNECTION_MEET_MAX     : 1203,
        CHANNEL_USER_CONNECTION_MEET_MAX: 1204,

        USER_NOT_IN_SERVER              : 1205,
        USER_NOT_IN_CHANNEL             : 1206,
        USER_CTX_NOT_FOUND              : 1207,

        TO_USER_NOT_IN_SERVER           : 1208,
        TO_USER_NOT_IN_ROOM             : 1209
    }
    
};