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
            fingerprintStorage: 'host, data, used, date'
        })
    }

    async get (host) {
        await this.fingerprintDB.open();
        return this.fingerprintDB.table('fingerprintStorage').get({ host })
    }

    async store (host, data) {
        try {
            await this.fingerprintDB.fingerprintStorage.put({host, data, date: Date.now(), used: false})
        } catch (e) {
            console.log(`Error storing agent data locally: ${e}`)
        }
    }

    async clearUnused() {
        const now = Date.now();
        const expiryTime = now - (60*1000); // 1 hour
        await this.fingerprintDB.open();
        return this.fingerprintDB.table('fingerprintStorage').filter(fp => {
            return !fp.used && fp.date < expiryTime;
        }).delete()
    }
}
module.exports = new FingerprintStorage()
