var MinuteStat = require('../../app/util/minuteStat')

var test = function(id, cb) {
    var stat = new MinuteStat()
    for (var i=0; i<10; ++i) {
        for (var j=0; j<=i; ++j) {
            stat.log(100+i, j+1)
        }
    }
    console.log('========== TEST %s ===========', id)
    cb(stat)
    console.log(stat.currMinToCount)
    console.log(stat.historyMinToCount)
}

var statEmpty = new MinuteStat()
console.log(statEmpty.stat(110, [1, 3, 5]))

test('print', function(stat){
})

test('stat(110, [1])', function(stat){
    console.log(stat.stat(110, [1]))
})

test('stat(110, [1, 3, 5])', function(stat){
    console.log(stat.stat(110, [1, 3, 5]))
})

test('stat(109, [1, 3, 10, 20])', function(stat){
    console.log(stat.stat(109, [1, 3, 10, 20]))
})


test('stat(120, [1, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22])', function(stat){
    console.log(stat.stat(120, [1, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 22]))
})


