const fingerprintService = require('../../shared/js/background/fingerprint-service.es6')

describe('Fingerprint service', () => {
    beforeEach(() => {
        fingerprintService.clearCache()
    })

    it('Each hostname should get a unique fingerprint', () => {
        let fp = fingerprintService.getFingerprintData('example.com')
        let fp2 = fingerprintService.getFingerprintData('example2.com')
        expect(fp.canvas).not.toEqual(fp2.canvas)
    })

    it('A hostname should provide a consistent result', () => {
        let fp = fingerprintService.getFingerprintData('example.com')
        let fp2 = fingerprintService.getFingerprintData('example.com')
        expect(fp.canvas).toEqual(fp2.canvas)
    })

    it('Fingerprint storage should expire', () => {
        const ONE_HOUR_MS = 60 * 60 * 1000
        const fp = fingerprintService.getFingerprintData('clearme.com')
        fingerprintService.clearExpiredCache(Date.now() + ONE_HOUR_MS + 1)
        const fp2 = fingerprintService.getFingerprintData('clearme.com')
        expect(fp.canvas).not.toEqual(fp2.canvas)
    })
})
