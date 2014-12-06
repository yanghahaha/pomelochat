var PREVILLEGE = {
    LOGIN:  1,
    WATCH:  1 << 1,
    SPEAK:  1 << 2,
    BAN:    1 << 3,
    KICK:   1 << 4,
    ALL:    1 << 30
};

var ROLE = {
    guest:    'GUEST',
    user:     'USER',
    moderator:'MODERATOR',
    owner:    'OWNER',
    admin:    'ADMIN'
};

var ROLE_PREVILLEGE = {
    GUEST:         PREVILLEGE.LOGIN | PREVILLEGE.WATCH,
    USER:          PREVILLEGE.LOGIN | PREVILLEGE.WATCH | PREVILLEGE.SPEAK,
    MODERATOR:     PREVILLEGE.LOGIN | PREVILLEGE.WATCH | PREVILLEGE.SPEAK | PREVILLEGE.BAN | PREVILLEGE.KICK,
    OWNER:         PREVILLEGE.LOGIN | PREVILLEGE.WATCH | PREVILLEGE.SPEAK | PREVILLEGE.BAN | PREVILLEGE.KICK,
    ADMIN:         PREVILLEGE.ALL
};

var exp = module.exports;

exp.PREVILLEGE = PREVILLEGE;

exp.validate = function(role) {
    return !!ROLE[role];
};

exp.getPrivillege = function(role) {
    var roleName = ROLE[role];
    if (!roleName) {
        throw new Error(util.format('role [%s] not vaild', role));
    }
    return ROLE_PREVILLEGE[roleName];
};
