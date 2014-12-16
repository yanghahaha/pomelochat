module.exports = {

    SUCC                                : 0,

    BAD_REQUEST                         : 400,
    INTERNAL_SERVER_ERROR               : 500,

    LOGIN: {
        TOKEN_INVALID                   : 1101,
        BIND_SESSION_ERROR              : 1102
    },

    ROOM: {
        USER_CHANNEL_MEET_MAX           : 1201,
        CHANNEL_USER_MEET_MAX           : 1202,
        CHANNEL_CONNECTION_MEET_MAX     : 1203,
        CHANNEL_USER_CONNECTION_MEET_MAX: 1204,

        CHANNEL_NOT_EXIST               : 1205,
        ROOM_NOT_EXIST                  : 1206,
        USER_NOT_EXIST                  : 1207,
        USER_NOT_IN_CHANNEL             : 1208,
        USER_CTX_NOT_FOUND              : 1209
    }

}