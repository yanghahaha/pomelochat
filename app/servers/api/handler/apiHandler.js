module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

/*
msg: {
    userId,
    userName,
}
*/
handler.applyToken = function(msg, session, next) {
    

}