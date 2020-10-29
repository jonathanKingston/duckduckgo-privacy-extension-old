const sha1 = require('./sha1')

module.exports = {
    /**
     * Produce a random float, same output as Math.random()
     * @returns {float}
     */
    getFloat () {
        return window.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32
    },

    /**
     * Produce a random integer between min and max
     * @param {int} min
     * @param {int} max
     * @returns {int}
     */
    getInt (min, max) {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(this.getFloat() * (max - min + 1)) + min
    },

    /**
     * Produce a random SHA1 hash
     * @returns {Object|null}
     */
    getHash () {
        return sha1(this.getFloat())
    },

    /**
     * In place shuffle an array items order
     * @param {array} array
     */
    shuffleArray (array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.getFloat() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]]
        }
    }
}
