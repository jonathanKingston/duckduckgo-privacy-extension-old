/**
 *  Tests for fingerprint defenses. Ensure that fingerprinting is actually being blocked.
 */

/* global dbg:false */
const harness = require('../helpers/harness')

let browser
let bgPage

const http = require('http');
const url = require('url');
const fs = require('fs');

function setupServer (redirects, port) {
  return http.createServer(function (req, res) {
    let url = new URL(req.url, `http://${req.headers.host}`);
    fs.readFile(__dirname + "/pages" + url.pathname, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end(JSON.stringify(err));
        return;
      }
      res.writeHead(200);
      res.end(data);
    });

  }).listen(port);

}

async function getFingerprintOfContext(ctx) {
  await ctx.addScriptTag({path: 'node_modules/@fingerprintjs/fingerprintjs/dist/fp.js'})
  return ctx.evaluate(() => {
      /* global FingerprintJS */
      return (async () => {
          let fp = await FingerprintJS.load()
          return fp.get()
      })()
  })
}

const frameTests = [
    'http://127.0.0.1:8081',
    'http://127.0.0.1:8080',
];

describe('First Party Fingerprint Randomization', () => {
    beforeAll(async () => {
        ({ browser, bgPage } = await harness.setup())
        const server = setupServer({}, 8080);
        const server2 = setupServer({}, 8081);

        // wait for HTTPs to successfully load
        await bgPage.waitForFunction(
            () => window.dbg && dbg.https.isReady,
            { polling: 100, timeout: 6000 }
        )
    })
    afterAll(async () => {
        await harness.teardown(browser)
    })

    frameTests.forEach(iframeHost => {
        it(`${iframeHost} frame should match the parent frame`, async () => {
            const page = await browser.newPage()
            // Load an page with an iframe from a different hostname
            await page.goto(`http://127.0.0.1:8080/index.html?host=${iframeHost}`, { waitUntil: 'networkidle0' })
            const fingerprint = await getFingerprintOfContext(page);
    
            const iframe = page.frames().find(iframe => iframe.url() == iframeHost + "/framed.html");
            const fingerprint2 = await getFingerprintOfContext(iframe);
    
            expect(fingerprint.components.plugins.value).toEqual(fingerprint2.components.plugins.value)
            expect(fingerprint.components.canvas.value.data).toEqual(fingerprint2.components.canvas.value.data)
        })
    })
})

