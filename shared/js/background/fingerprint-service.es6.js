const sha1 = require('../shared-utils/sha1')
// eslint-disable-next-line node/no-deprecated-api
const punycode = require('punycode')
const ONE_HOUR_MS = 60 * 60 * 1000

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
        let colorStops = []
        for (let i = 0; i < this.getRandomInt(2, 5); i++) {
            // 0.001 isn't rendered anything above 0.005 can become visible
            let cs = {
                r: this.getRandomInt(0, 255),
                g: this.getRandomInt(0, 255),
                b: this.getRandomInt(0, 255),
                a: this.getRandomInt(1, 5) * 0.001
            }
            colorStops.push(cs)
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
            canvas: {cs: colorStops},
            plugins: pluginsOut
        }
    }

    /**
     * @param {string} host
     * @returns {Object}
     */
    getFingerprint (host) {
        const cache = this.checkInCache(host)
        if (cache) {
            return cache
        }
        const data = this.generateNewFingerprint()
        this._cacheResult(host, data)
        // TODO store data
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
