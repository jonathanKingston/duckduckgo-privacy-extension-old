/**
 * Manages fingerprint protection of JavaScript browser API's. Overwrites
 * object properties and methods to reduce entropy or modify fingerprint
 * data through obsufcation / randomness.
 */

(async function protect () {
    // Exclude some content types from injection
    const elem = document.head || document.documentElement
    try {
        const contentType = elem.ownerDocument.contentType
        if (contentType === 'application/xml' ||
            contentType === 'application/json' ||
            contentType === 'text/xml' ||
            contentType === 'text/json' ||
            contentType === 'text/rss+xml' ||
            contentType === 'application/rss+xml'
        ) {
            return
        }
    } catch (e) {
        // if we can't find content type, go ahead with injection.
    }

    // Property values to be set and their original values.
    const fingerprintPropertyValues = {
        'screen': {
            'availTop': {
                'object': 'Screen.prototype',
                'origValue': screen.availTop,
                'targetValue': 0
            },
            'availLeft': {
                'object': 'Screen.prototype',
                'origValue': screen.availLeft,
                'targetValue': 0
            },
            'availWidth': {
                'object': 'Screen.prototype',
                'origValue': screen.availWidth,
                'targetValue': screen.width
            },
            'availHeight': {
                'object': 'Screen.prototype',
                'origValue': screen.availHeight,
                'targetValue': screen.height
            },
            'colorDepth': {
                'object': 'Screen.prototype',
                'origValue': screen.colorDepth,
                'targetValue': 24
            },
            'pixelDepth': {
                'object': 'Screen.prototype',
                'origValue': screen.pixelDepth,
                'targetValue': 24
            }
        },
        'hardware': {
            'keyboard': {
                'object': 'Navigator.prototype',
                'origValue': navigator.keyboard,
                'targetValue': undefined
            },
            'hardwareConcurrency': {
                'object': 'Navigator.prototype',
                'origValue': navigator.hardwareConcurrency,
                'targetValue': 8
            },
            'deviceMemory': {
                'object': 'Navigator.prototype',
                'origValue': navigator.deviceMemory,
                'targetValue': 8
            }
        },
        /*
        'useragent': {
//            'userAgent': {
//                'object': 'navigator',
//                'origValue': navigator.userAgent,
//                'targetValue': ddg_ext_ua // Defined in chrome-events.es6.js and injected as a variable
//            },
              'appVersion': {
                'object': 'navigator',
                'origValue': navigator.appVersion,
                'targetValue': getAppVersionValue()
            }
        },
        */
        'options': {
            'doNotTrack': {
                'object': 'Navigator.prototype',
                'origValue': navigator.doNotTrack,
                'targetValue': /Firefox/i.test(navigator.userAgent) ? 'unspecified' : null
            }
        }
    }

    // ddg_referrer is defined in chrome-events.es6.js and injected as a variable if referrer should be modified
    // Unfortunately, we only have limited information about the referrer and current frame. A single
    // page may load many requests and sub frames, all with different referrers. Since we
    if (ddg_referrer && // make sure the referrer was set correctly
        ddg_referrer.referrer !== undefined && // referrer value will be undefined when it should be unchanged.
        document.referrer && // don't change the value if it isn't set
        document.referrer !== '' && // don't add referrer information
        new URL(document.URL).hostname !== new URL(document.referrer).hostname) { // don't replace the referrer for the current host.
        let trimmedReferer = document.referrer
        if (new URL(document.referrer).hostname === ddg_referrer.referrerHost) {
            // make sure the real referrer & replacement referrer match if we're going to replace it
            trimmedReferer = ddg_referrer.referrer
        } else {
            // if we don't have a matching referrer, just trim it to origin.
            trimmedReferer = new URL(document.referrer).origin + '/'
        }
        fingerprintPropertyValues['document'] = {
            'referrer': {
                'object': 'Document.prototype',
                'origValue': document.referrer,
                'targetValue': trimmedReferer
            }
        }
    }

    /**
     * the navigator.appVersion is sometimes used to 'validate' the user agent. In Firefox, this
     * returns a truncated version of the user Agent with just the OS type (X11, Macintosh, etc). Chrome
     * returns the full user Agent.
     *
     * This function returns the spoofed user agent, unless the browser is FireFox, when it leaves it unchanged.
     */
    function getAppVersionValue () {
        if (/Firefox/i.test(navigator.userAgent)) {
            // Running Firefox, so keep the original value.
            return navigator.appVersion
        }
        // UserAgent is in the format of "Mozilla/<details>", appVersion only includes the details portion
        return ddg_ext_ua.replace('Mozilla/', '')
    }

    /**
     * For each property defined on the object, update it with the target value.
     */
    function buildScriptProperties () {
        let script = ''
        for (const category in fingerprintPropertyValues) {
            for (const [name, prop] of Object.entries(fingerprintPropertyValues[category])) {
                // Don't update if existing value is undefined or null
                if (!(prop.origValue === undefined)) {
                    /**
                     * When re-defining properties, we bind the overwritten functions to null. This prevents
                     * sites from using toString to see if the function has been overwritten
                     * without this bind call, a site could run something like
                     * `Object.getOwnPropertyDescriptor(Screen.prototype, "availTop").get.toString()` and see
                     * the contents of the function. Appending .bind(null) to the function definition will
                     * have the same toString call return the default [native code]
                     */
                    script += `try {
                        Object.defineProperty(${prop.object}, "${name}", {get: (() => ${JSON.stringify(prop.targetValue)}).bind(null)});
                    } catch (e) {}
                    `
                }
            }
        }
        return script
    }

    /**
     *  Build a script that overwrites the Battery API if present in the browser.
     *  It will return the values defined in the getBattery function to the client,
     *  as well as prevent any script from listening to events.
     */
    function buildBatteryScript () {
        if (navigator.getBattery) {
            let batteryScript = `
                let spoofedValues = {
                    charging: true,
                    chargingTime: 0,
                    dischargingTime: Infinity,
                    level: 1
                }
                let eventProperties = ['onchargingchange', 'onchargingtimechange', 'ondischargingtimechange', 'onlevelchange']

                for (const [prop, val] of Object.entries(spoofedValues)) {
                    try {
                        Object.defineProperty(BatteryManager.prototype, prop, { get: ( () => val).bind(null) })
                    } catch(e) { }
                }
                for (const eventProp of eventProperties) {
                    try {
                        Object.defineProperty(BatteryManager.prototype, eventProp, { get: ( () => null).bind(null) })
                    } catch(e) { }
                }
            `
            return batteryScript
        } else {
            return ''
        }
    }

    async function getSjcl() {
      const url = chrome.runtime.getURL('/data/sjcl.js');

      let response = await fetch(url);
      return await response.text();
    }


    /**
     * Build a script that overloads the Canvas API to add gradients that are different per first party.
     * Taking the randomized values from `ddg_ext_fingerprint.canvas` the script:
     * - Takes the original canvas value and places it into an off screen canvas.
     * - Adds a radial gradient at a random position.
     * - Creates a random amount of colour stops with colours that are almost impossible to see.
     * - Returns the value out of the original `toDataURL` call.
     */
    async function buildCanvasScript () {
        return (await getSjcl()) + `
        const sessionKey = ${JSON.stringify(ddg_session_key)};
        const domainKey = window.top.location.origin;

        function getCanvasKeySync(sessionKey, domainKey, inputData) {
            let hmac = new sjcl.misc.hmac(sjcl.codec.utf8String.toBits(sessionKey + domainKey), sjcl.hash.sha256);
            return sjcl.codec.hex.fromBits(hmac.encrypt(inputData));
        }

        // linear feedback shift register to find a random approximation
        function nextRandom(v) {
            return Math.abs((v >> 1) | (((v << 62) ^ (v << 61)) & (~(~0 << 63) << 62)));
        }

        const _getImageData = CanvasRenderingContext2D.prototype.getImageData;
        function getImageData() {
            let imageData = _getImageData.apply(this, arguments);
            let canvasKey = getCanvasKeySync(sessionKey, domainKey, imageData);

            console.log({imageData, width: this.width, sessionKey, domainKey, canvasKey});

            let pixel = canvasKey[0];
            for (let i in canvasKey) {
                console.log({i, pixel});
                let byte = canvasKey[i];
                for (let j = 8; j >= 0; j--) {
                    let pixelCanvasIndex = pixel % imageData.data.length;
/*
                    console.log("pixel modification", {
                      bit: byte & 0x1,
                      pixelCanvasIndex,
                      id: imageData.data[pixelCanvasIndex],
                      idm: imageData.data[pixelCanvasIndex] ^ (byte & 0x1)
                    });
*/

                    imageData.data[pixelCanvasIndex] = imageData.data[pixelCanvasIndex] ^ (byte & 0x1);
                    // find next pixel to perturb
                    pixel = nextRandom(pixel);

                    // Right shift as we use the least significant bit of it
                    byte = byte >> 1;
                }
            }
            return imageData;
        }
        Object.defineProperty(CanvasRenderingContext2D.prototype, 'getImageData', {
            value: getImageData,
        });

// TODO hide toString
        let canvasMethods = ['toDataURL', 'toBlob']
        for (let methodName of canvasMethods) {
            let _method = HTMLCanvasElement.prototype[methodName];
            let method = function method() {
                let ctx = this.getContext('2d');
                let imageData = ctx.getImageData(0, 0, this.width, this.height);

                // Make a off-screen canvas and put the data there
                let offScreenCanvas = document.createElement('canvas');
                offScreenCanvas.width = this.width;
                offScreenCanvas.height = this.height;
                let offScreenCtx = offScreenCanvas.getContext('2d');
                offScreenCtx.putImageData(imageData, 0, 0);

                // Call the original method on the modified off-screen canvas
                return _method.apply(offScreenCanvas, arguments);
            }
            Object.defineProperty(HTMLCanvasElement.prototype, methodName, {
                get: method,
            });
        }
        `
    }

    /**
     * All the steps for building the injection script. Should only be done at initial page load.
     */
    async function buildInjectionScript () {
        let script = buildScriptProperties()
        script += modifyTemporaryStorage()
        script += buildBatteryScript()
        script += setWindowDimensions()
        script += await buildCanvasScript()
        return script
    }

    /**
     * normalize window dimensions, if more than one monitor is in play.
     *  X/Y values are set in the browser based on distance to the main monitor top or left, which
     * can mean second or more monitors have very large or negative values. This function maps a given
     * given coordinate value to the proper place on the main screen.
     */
    function normalizeWindowDimension (value, targetDimension) {
        if (value > targetDimension) {
            return value % targetDimension
        }
        if (value < 0) {
            return targetDimension + value
        }
        return value
    }

    function setWindowPropertyValue (property, value) {
        // Here we don't update the prototype getter because the values are updated dynamically
        let script = `
            try {
                Object.defineProperty(window, "${property}", {
                    get: ( () => ${value}).bind(null),
                    set: ( () => {}).bind(null),
                    configurable: true
                });
            } catch (e) {}
        `
        return script
    }

    /**
     * Fix window dimensions. The extension runs in a different JS context than the
     * page, so we can inject the correct screen values as the window is resized,
     * ensuring that no information is leaked as the dimensions change, but also that the
     * values change correctly for valid use cases.
     */
    function setWindowDimensions () {
        let windowScript = ''
        try {
            const normalizedY = normalizeWindowDimension(window.screenY, window.screen.height)
            const normalizedX = normalizeWindowDimension(window.screenX, window.screen.width)
            if (normalizedY <= fingerprintPropertyValues.screen.availTop.origValue) {
                windowScript += setWindowPropertyValue('screenY', 0)
                windowScript += setWindowPropertyValue('screenTop', 0)
            } else {
                windowScript += setWindowPropertyValue('screenY', normalizedY)
                windowScript += setWindowPropertyValue('screenTop', normalizedY)
            }

            if (top.window.outerHeight >= fingerprintPropertyValues.screen.availHeight.origValue - 1) {
                windowScript += setWindowPropertyValue('outerHeight', top.window.screen.height)
            } else {
                try {
                    windowScript += setWindowPropertyValue('outerHeight', top.window.outerHeight)
                } catch (e) {
                    // top not accessible to certain iFrames, so ignore.
                }
            }

            if (normalizedX <= fingerprintPropertyValues.screen.availLeft.origValue) {
                windowScript += setWindowPropertyValue('screenX', 0)
                windowScript += setWindowPropertyValue('screenLeft', 0)
            } else {
                windowScript += setWindowPropertyValue('screenX', normalizedX)
                windowScript += setWindowPropertyValue('screenLeft', normalizedX)
            }

            if (top.window.outerWidth >= fingerprintPropertyValues.screen.availWidth.origValue - 1) {
                windowScript += setWindowPropertyValue('outerWidth', top.window.screen.width)
            } else {
                try {
                    windowScript += setWindowPropertyValue('outerWidth', top.window.outerWidth)
                } catch (e) {
                    // top not accessible to certain iFrames, so ignore.
                }
            }
        } catch (e) {
            // in a cross domain iFrame, top.window is not accessible.
        }

        return windowScript
    }

    /**
     * Temporary storage can be used to determine hard disk usage and size.
     * This will limit the max storage to 4GB without completely disabling the
     * feature.
     */
    function modifyTemporaryStorage () {
        const script = `
            if (navigator.webkitTemporaryStorage) {
                try {
                    const org = navigator.webkitTemporaryStorage.queryUsageAndQuota
                    const tStorage = navigator.webkitTemporaryStorage
                    tStorage.queryUsageAndQuota = function queryUsageAndQuota (callback, err) {
                        const modifiedCallback = function (usedBytes, grantedBytes) {
                            const maxBytesGranted = 4 * 1024 * 1024 * 1024
                            const spoofedGrantedBytes = Math.min(grantedBytes, maxBytesGranted)
                            callback(usedBytes, spoofedGrantedBytes)
                        }
                        org.call(navigator.webkitTemporaryStorage, modifiedCallback, err)
                    }.bind(null)
                    Object.defineProperty(Navigator.prototype, 'webkitTemporaryStorage', {get: (() => tStorage).bind(null)})
                }
                catch(e) {}
            }
        `
        return script
    }

    /**
     * Inject all the overwrites into the page.
     */
    function inject (scriptToInject, removeAfterExec, elemToInject) {
        // Inject into main page
        try {
            let e = document.createElement('script')
            e.textContent = `(() => {
                ${scriptToInject}
            })();`
            elemToInject.appendChild(e)

            if (removeAfterExec) {
                e.remove()
            }
        } catch (e) {
        }
    }

    window.addEventListener('resize', function () {
        const windowScript = setWindowDimensions()
        inject(windowScript, true, elem)
    })

    const injectionScript = await buildInjectionScript()
    inject(injectionScript, true, elem)
})()
