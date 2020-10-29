const sha1 = require('../shared-utils/sha1')
// eslint-disable-next-line node/no-deprecated-api
const punycode = require('punycode')
const ONE_HOUR_MS = 60 * 60 * 1000

const fingerprintStorage = require('./storage/fingerprints.es6')

class FingerprintService {
    constructor () {
        this._cache = new Map()
        this._activeRequests = new Map()
    }

    _cacheResult (host, data) {
        const hash = this._hostToHash(host)
        let expiryDate = Date.now() + ONE_HOUR_MS

        this._cache.set(hash, {
            expires: expiryDate,
            data: data
        })
    }

    _hostToHash (host) {
        return sha1(punycode.toASCII(host.toLowerCase()))
    }

    /**
     * @param {string} host
     * @returns {Object|null}
     */
    checkInCache (host) {
        const hash = this._hostToHash(host)
        const result = this._cache.get(hash)

        if (result) {
            return result.data
        }

        return null
    }

    randomFloat () {
        return window.crypto.getRandomValues(new Uint32Array(1))[0] / 2**32
    }

    getRandomInt (min, max) {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(this.randomFloat() * (max - min + 1)) + min
    }

    getRandomHash () {
        return sha1(this.randomFloat())
    }

    generateNewFingerprint () {
        // Generate a cirle coordinates as a % of the canvas size
        // The X and Y position will be within the 25-75 percentile
        // This ensures the circle will also be visible whist some circles only partially visible
        // The radius of the circle with also be within 25-75% of the canvas size
        let outerLowerSize = 25;
        let outerUpperSize = 75;
        // For simplicity let's make both circles centred on the same spot
        let x = this.getRandomInt(outerLowerSize, outerUpperSize);
        let y = this.getRandomInt(outerLowerSize, outerUpperSize);
        let r1 = this.getRandomInt(outerLowerSize, outerUpperSize);
        let r0 = r1*(this.getRandomInt(1, 50)*0.1); // Between 10-50% of the outer circle size
        let canvasOut = {
          x0: x,
          y0: y,
          r0,
          x1: x,
          y1: y,
          r1,
          cs: []
        }

        // Generate some colour stops for the circle gradient
        for (let i = 0; i < this.getRandomInt(2, 5); i++) {
            // 0.001 isn't rendered anything above 0.005 can become visible
            let cs = {
                r: this.getRandomInt(0, 255),
                g: this.getRandomInt(0, 255),
                b: this.getRandomInt(0, 255),
                a: this.getRandomInt(1, 5) * 0.001
            }
            canvasOut.cs.push(cs)
        }

        let plugins = navigator.plugins
        let pluginsOut = []
        for (let plugin of plugins) {
            let mimeTypes = []
            for (let mimeType of plugin) {
                mimeTypes.push({
                    type: mimeType.type,
                    description: this.getRandomHash(),
                    suffixes: mimeType.suffixes
                })
            }
            let name = plugin.name
            let description = plugin.description
            // Support for PDF is still needed
            if (!name.match('PDF')) {
                name = this.getRandomHash().substr(0, this.getRandomInt(5, 10))
                description = this.getRandomHash()
            }
            let obj = {
                name,
                filename: this.getRandomHash(),
                version: plugin.version,
                description,
                mimeTypes
            }
            pluginsOut.push(obj)
        }
        // TODO shuffle plugin array

        return {
            canvas: canvasOut,
            plugins: pluginsOut
        }
    }

    /**
     * @param {string} host
     * @returns {Object}
     */
    async getFingerprint (host) {
        const cache = this.checkInCache(host)
        if (cache) {
            return cache
        }

        const res = await fingerprintStorage.get(host);
        if (res) {
            return res;
        }
        const data = this.generateNewFingerprint()
        fingerprintStorage.store(host, data);
        this._cacheResult(host, data)

        return data
    }

    clearCache () {
        this._cache.clear()
    }

    clearExpiredCache () {
        const now = Date.now()

        Array.from(this._cache.keys())
            .filter(key => this._cache.get(key).expires < now)
            .forEach(key => this._cache.delete(key))
    }
}

module.exports = new FingerprintService()
