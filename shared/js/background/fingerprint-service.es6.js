const sha1 = require('../shared-utils/sha1')
const random = require('../shared-utils/random')
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

    /**
     * Generates random fingerprint seed data.
     * @returns {Object|null}
     */
    generateNewFingerprintData () {
        // Generate a cirle coordinates as a % of the canvas size
        // The X and Y position will be within the 25-75 percentile
        // This ensures the circle will also be visible whist some circles only partially visible
        // The radius of the circle with also be within 25-75% of the canvas size
        let outerLowerSize = 25
        let outerUpperSize = 75
        // For simplicity let's make both circles centred on the same spot
        let x = random.getInt(outerLowerSize, outerUpperSize)
        let y = random.getInt(outerLowerSize, outerUpperSize)
        let r1 = random.getInt(outerLowerSize, outerUpperSize)
        let r0 = r1 * (random.getInt(1, 50) * 0.1) // Between 10-50% of the outer circle size
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
        for (let i = 0; i < random.getInt(2, 5); i++) {
            // 0.001 isn't rendered anything above 0.005 can become visible
            let cs = {
                r: random.getInt(0, 255),
                g: random.getInt(0, 255),
                b: random.getInt(0, 255),
                a: random.getInt(1, 5) * 0.001
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
                    description: random.getHash(),
                    suffixes: mimeType.suffixes
                })
            }
            let name = plugin.name
            let description = plugin.description
            // Support for PDF is still needed
            if (!name.match('PDF')) {
                name = random.getHash().substr(0, random.getInt(5, 10))
                description = random.getHash()
            }
            let obj = {
                name,
                filename: random.getHash(),
                version: plugin.version,
                description,
                mimeTypes
            }
            pluginsOut.push(obj)
        }

        random.shuffleArray(pluginsOut)

        return {
            canvas: canvasOut,
            plugins: pluginsOut
        }
    }

    /**
     * @param {string} host
     * @returns {Object}
     */
    getFingerprintData (host) {
        const cache = this.checkInCache(host)
        if (cache) {
            return cache
        }

        const data = this.generateNewFingerprintData()
        this._cacheResult(host, data)

        return data
    }

    clearCache () {
        this._cache.clear()
    }

    clearExpiredCache (expiryTime) {
        expiryTime = expiryTime || Date.now()

        Array.from(this._cache.keys())
            .filter(key => this._cache.get(key).expires < expiryTime)
            .forEach(key => this._cache.delete(key))
    }
}

module.exports = new FingerprintService()
