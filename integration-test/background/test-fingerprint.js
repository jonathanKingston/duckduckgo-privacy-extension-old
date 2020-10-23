/**
 *  Tests for fingerprint defenses. Ensure that fingerprinting is actually being blocked.
 */

/* global dbg:false */
const harness = require('../helpers/harness')

let browser
let bgPage

const expectedFingerprintValues = {
    availTop: 0,
    availLeft: 0,
    wAvailTop: 0,
    wAvailLeft: 0,
    colorDepth: 24,
    pixelDepth: 24,
    doNotTrack: null,
    productSub: '20030107',
    vendorSub: ''
}

const tests = [
    {url: 'wikipedia.com'},
    {url: 'reddit.com'}
]

function testFPValues (values) {
    for (const [name, prop] of Object.entries(values)) {
        expect(prop).withContext(`${name}`).toEqual(expectedFingerprintValues[name])
    }
}

describe('Fingerprint Defense Tests', () => {
    beforeAll(async () => {
        ({ browser, bgPage } = await harness.setup())

        // wait for HTTPs to successfully load
        await bgPage.waitForFunction(
            () => window.dbg && dbg.https.isReady,
            { polling: 100, timeout: 60000 }
        )
    })
    afterAll(async () => {
        await harness.teardown(browser)
    })

    tests.forEach(test => {
        it(`${test.url} should include anti-fingerprinting code`, async () => {
            const page = await browser.newPage()
            const ua = await browser.userAgent()
            await page.setUserAgent(ua.replace(/Headless /, ''))

            try {
                await page.goto(`http://${test.url}`, { waitUntil: 'networkidle0' })
            } catch (e) {
                // timed out waiting for page to load, let's try running the test anyway
            }
            // give it another second just to be sure
            await page.waitFor(1000)
            const values = await page.evaluate(() => {
                return {
                    availTop: screen.availTop,
                    availLeft: screen.availLeft,
                    wAvailTop: window.screen.availTop,
                    wAvailLeft: window.screen.availLeft,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    doNotTrack: navigator.doNotTrack,
                    productSub: navigator.productSub,
                    vendorSub: navigator.vendorSub
                }
            })
            testFPValues(values)

            await page.close()
        })
    })
})

describe('First Party Fingerprint Randomization', () => {
    beforeAll(async () => {
        ({ browser, bgPage } = await harness.setup())

        // wait for HTTPs to successfully load
        await bgPage.waitForFunction(
            () => window.dbg && dbg.https.isReady,
            { polling: 100, timeout: 60000 }
        )
    })
    afterAll(async () => {
        await harness.teardown(browser)
    })

    it('Fingerprints should not match across first parties', async () => {
        let canvasResults = new Set()
        let pluginResults = new Set()
        for (let test of tests) {
            const page = await browser.newPage()

            try {
                await page.goto(`http://${test.url}`, { waitUntil: 'networkidle0' })
            } catch (e) {
                // timed out waiting for page to load, let's try running the test anyway
            }
            // give it another second just to be sure
            await page.waitFor(1000)

            await page.addScriptTag({path: 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.js'})

            const fingerprint = await page.evaluate(() => {
                /* global FingerprintJS */
                return (async () => {
                    let fp = await FingerprintJS.load()
                    return fp.get()
                })()
            })

            // Add the fingerprints to a set, if the result doesn't match it won't be added
            canvasResults.add(fingerprint.components.canvas.value.data)
            pluginResults.add(fingerprint.components.plugins.value.data)

            // TODO load the first party twice and verify that we don't generate multiple fingerprints

            // TODO load an third party iframe and verify that the signatures match the first party

            await page.close()
        }

        // Ensure that the number of test pages match the number in the set
        expect(canvasResults.size).toEqual(tests.length)
        expect(pluginResults.size).toEqual(tests.length)
    })
})
