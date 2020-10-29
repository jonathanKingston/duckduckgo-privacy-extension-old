// Babel includes for async/await
import 'regenerator-runtime/runtime'

const load = require('./../load.es6')
const Dexie = require('dexie')
const constants = require('../../../data/constants')
const settings = require('./../settings.es6')

/**
 *  Manage local fingerprint data.
 **/
class FingerprintStorage {
    constructor () {
        this.fingerprintDB = new Dexie('fingerprintStorage')
        this.fingerprintDB.version(1).stores({
            fingerprintStorage: 'host, data'
        })
    }

    get (host) {
        return this.fingerprintDB.open()
            .then(() => this.fingerprintDB.table('fingerprintStorage').get({ host }))
    }

    async store (host, data) {
        try {
            await this.fingerprintDB.fingerprintStorage.put({host, data})
        } catch (e) {
            console.log(`Error storing agent data locally: ${e}`)
        }
    }
}
module.exports = new FingerprintStorage()
