var logger = require('pomelo-logger');
logger.configure({
    "appenders": [
        {
            "type": "console"
        }
    ],
    "levels": {
        "[all]": "DEBUG"
    },
    "replaceConsole": true
});

var tokenService = require('../app/modules/token');
var Code = require('../app/modules/code');

var userId = 1;
var channelId = 111;
var data = {role:'admin'};
var token, code, out = {};

code = tokenService.apply(userId, channelId, data, out);
console.log(out.token);
code = tokenService.apply(userId, channelId, data, out);
console.log(out.token);