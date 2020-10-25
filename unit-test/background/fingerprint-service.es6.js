const fingerprintService = require('../../shared/js/background/fingerprint-service.es6')

describe('Fingerprint service', () => {
    beforeEach(() => {
        fingerprintService.clearCache()
    })

    it('Each hostname should get a unique fingerprint', () => {
        let fp = fingerprintService.getFingerprint('example.com')
        let fp2 = fingerprintService.getFingerprint('example2.com')
        expect(fp.canvas).not.toEqual(fp2.canvas)
    })

    it('A hostname should provide a consistent result', () => {
        let fp = fingerprintService.getFingerprint('example.com')
        let fp2 = fingerprintService.getFingerprint('example.com')
        expect(fp.canvas).toEqual(fp2.canvas)
    })
})
