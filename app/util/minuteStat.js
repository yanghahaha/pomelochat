var MinuteStat = function() {
    this.currMinToCount = null  //{min: count}
    this.historyMinToCount = [
        //{min: count}
    ]
}

module.exports = MinuteStat

MinuteStat.prototype.log = function(min, count) {
    if (!this.currMinToCount) {
        this.currMinToCount = {
            min: min,
            count: count
        }
    }
    else {
        if (this.currMinToCount.min === min) {
            this.currMinToCount.count += count
        }
        else if (this.currMinToCount.min < min) {
            this.historyMinToCount.unshift(this.currMinToCount)
            this.currMinToCount = {
                min: min,
                count: count
            }
        }
    }
}

MinuteStat.prototype.stat = function(currTimeMin, minutesToStat) {
    if (!!this.currMinToCount && this.currMinToCount.min < currTimeMin) {
        this.historyMinToCount.unshift(this.currMinToCount)
        this.currMinToCount = null
    }

    var stats = {}
    for (var k=0; k<minutesToStat.length; ++k) {
        stats[minutesToStat[k]] = 0
    }

    var maxMinCount = minutesToStat[minutesToStat.length-1]
    if (!maxMinCount) {
        return stats
    }

    var statIndex = 0,
        count = 0,
        i = 0

    for (; i<this.historyMinToCount.length; ++i) {
        var minRange = currTimeMin - this.historyMinToCount[i].min
        if (minRange > minutesToStat[statIndex]) {
            stats[minutesToStat[statIndex]] = count
            var loopProtector = 0
            while (1) {
                statIndex++
                if (statIndex >= minutesToStat.length) {
                    break
                }
                if (minRange > minutesToStat[statIndex]) {
                    stats[minutesToStat[statIndex]] = count
                }
                else {
                    break
                }

                if (++loopProtector > 100) {
                    console.error('loop over 100 times')
                    break
                }
            }
            if (statIndex >= minutesToStat.length) {
                break
            }
        }
        count += this.historyMinToCount[i].count
    }

    for (;statIndex < minutesToStat.length; ++ statIndex) {
        stats[minutesToStat[statIndex]] = count
    }

    this.historyMinToCount.splice(i)
    return stats
}
