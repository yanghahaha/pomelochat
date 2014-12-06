module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

var remote = Remote.prototype;

/*
msg: {
    userId,
    userName,
}
*/
remote.applyToken = function(msg, session, next) {
    

}