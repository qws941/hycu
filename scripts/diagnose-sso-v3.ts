/**
 * Diagnostic v3: Understand MagicSA storage mechanism and inject keyStore via API.
 */
import { chromium } from "playwright";
import { config } from "../src/config.js";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });
  const page = await context.newPage();

  // Navigate to SSO first (need page JS loaded)
  console.log("[diag] navigating to sso.hycu.ac.kr...");
  await page.goto("https://sso.hycu.ac.kr/", { waitUntil: "networkidle", timeout: 30000 });
  console.log("[diag] URL:", page.url());

  // Step 1: Inspect MagicSA internals
  console.log("\n=== MagicSA Internals ===");
  const internals = await page.evaluate(`(function() {
    if (!window.magicsa) return { error: "magicsa not initialized" };
    var result = {};
    
    // List all own properties
    result.ownProps = Object.keys(magicsa);
    
    // List prototype methods
    result.protoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(magicsa))
      .filter(function(m) { return typeof magicsa[m] === 'function'; });
    
    // Check key properties
    result.keyName = magicsa.keyName;
    result._keyName = magicsa._keyName;
    result.serverUrl = magicsa.serverUrl;
    result._serverUrl = magicsa._serverUrl;
    result.storageType = magicsa.storageType;
    result._storageType = magicsa._storageType;
    result.storage = typeof magicsa.storage;
    result._storage = typeof magicsa._storage;
    
    // Check config
    if (magicsa.config) {
      result.config = JSON.stringify(magicsa.config).substring(0, 500);
    }
    if (magicsa._config) {
      result._config = JSON.stringify(magicsa._config).substring(0, 500);
    }
    if (magicsa.options) {
      result.options = JSON.stringify(magicsa.options).substring(0, 500);
    }
    
    return result;
  })()`);
  console.log(JSON.stringify(internals, null, 2));

  // Step 2: Check MagicSA constructor source
  console.log("\n=== MagicSA Constructor ===");
  const ctorSrc = await page.evaluate(`(function() {
    return window.MagicSA ? window.MagicSA.toString().substring(0, 1500) : "NOT_FOUND";
  })()`);
  console.log(ctorSrc);

  // Step 3: Check getKeyStore source
  console.log("\n=== getKeyStore source ===");
  const getSrc = await page.evaluate(`(function() {
    return magicsa.getKeyStore ? magicsa.getKeyStore.toString().substring(0, 1000) : "NOT_FOUND";
  })()`);
  console.log(getSrc);

  // Step 4: Check setKeyStore source
  console.log("\n=== setKeyStore source ===");
  const setSrc = await page.evaluate(`(function() {
    return magicsa.setKeyStore ? magicsa.setKeyStore.toString().substring(0, 1000) : "NOT_FOUND";
  })()`);
  console.log(setSrc);

  // Step 5: Check cookie storage methods
  console.log("\n=== Cookie/Storage Methods ===");
  const storageSrc = await page.evaluate(`(function() {
    var result = {};
    // Check for internal storage object
    if (magicsa._storage) {
      result._storageMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(magicsa._storage))
        .filter(function(m) { return typeof magicsa._storage[m] === 'function'; });
      result._storageType = magicsa._storage.constructor.name;
    }
    if (magicsa.storage) {
      result.storageMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(magicsa.storage))
        .filter(function(m) { return typeof magicsa.storage[m] === 'function'; });
      result.storageType = magicsa.storage.constructor.name;
    }
    
    // Check getCookie / setCookie
    if (typeof magicsa.getCookie === 'function') {
      result.getCookieSrc = magicsa.getCookie.toString().substring(0, 500);
    }
    if (typeof magicsa.setCookie === 'function') {
      result.setCookieSrc = magicsa.setCookie.toString().substring(0, 500);
    }
    
    // Try reading cookie directly using MagicSA's cookie path
    var cookieVal = document.cookie.split(';').map(function(c) { return c.trim(); })
      .find(function(c) { return c.startsWith('dreamsecurity/magicsa/keyStore='); });
    result.rawCookieValue = cookieVal ? cookieVal.substring(0, 200) : "NOT_FOUND";
    
    // Check all cookies
    result.allCookieNames = document.cookie.split(';').map(function(c) { return c.trim().split('=')[0]; });
    
    return result;
  })()`);
  console.log(JSON.stringify(storageSrc, null, 2));

  // Step 6: Try injecting via setKeyStore()
  console.log("\n=== Injecting keyStore via setKeyStore() ===");
  const keyStoreData = JSON.parse(config.fido.keyStoreJson);
  const injectResult = await page.evaluate(`(function() {
    try {
      var ksData = ${JSON.stringify(keyStoreData)};
      
      // Try setKeyStore
      if (typeof magicsa.setKeyStore === 'function') {
        magicsa.setKeyStore(ksData);
        var after = magicsa.getKeyStore();
        return {
          method: 'setKeyStore',
          success: true,
          afterType: typeof after,
          afterKeys: after ? Object.keys(after) : [],
          afterLength: after ? JSON.stringify(after).length : 0,
        };
      }
      return { error: "setKeyStore not a function" };
    } catch(e) {
      return { error: e.message, stack: e.stack?.substring(0, 300) };
    }
  })()`);
  console.log(JSON.stringify(injectResult, null, 2));

  // Step 7: After injection, try fnDefaultPinLoginForm
  console.log("\n=== After injection: fnDefaultPinLoginForm() ===");
  const afterInjectForm = await page.evaluate(`(function() {
    try {
      fnDefaultPinLoginForm();
      return {
        authForm: document.getElementById('authForm')?.style.display,
        loginForm: document.getElementById('loginForm')?.style.display,
        pinBtn: document.getElementById('pinBtn')?.style.display,
        loginPinBtn: document.getElementById('loginPinBtn')?.style.display,
        loginIdPinValue: document.getElementById('loginIdPin')?.value,
      };
    } catch(e) {
      return { error: e.message };
    }
  })()`);
  console.log(JSON.stringify(afterInjectForm, null, 2));

  await page.screenshot({ path: "diag-v3-after-inject.png" });

  // Step 8: If injection worked and loginForm visible, try full login
  if (afterInjectForm && (afterInjectForm as any).loginForm === 'block') {
    console.log("\n=== Login form visible! Attempting full login... ===");
  } else {
    console.log("\n=== Login form still hidden. Trying manual approach... ===");
    
    // Manual: show form, set fields, try fnLoginPin
    await page.evaluate(`(function() {
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('pinBtn').style.display = 'none';
      document.getElementById('loginPinBtn').style.display = 'block';
      document.getElementById('loginIdPin').value = '2024112536';
      var pinInput = document.getElementById('pinNo');
      pinInput.removeAttribute('readonly');
      pinInput.value = '379100';
      pinInput.setAttribute('readonly', 'readonly');
    })()`);
    
    // Now try fnLoginPin with network monitoring
    const networkLog: string[] = [];
    page.on("request", (req) => {
      networkLog.push("REQ: " + req.method() + " " + req.url().substring(0, 150));
    });
    page.on("response", (res) => {
      networkLog.push("RES: " + res.status() + " " + res.url().substring(0, 150));
    });

    // Check fnLoginPin source to understand what it does
    console.log("\n=== fnLoginPin source ===");
    const fnSrc = await page.evaluate(`(function() {
      return typeof fnLoginPin === 'function' ? fnLoginPin.toString() : 'NOT_FOUND';
    })()`);
    console.log(fnSrc);

    // Check fnProcessPinState source
    console.log("\n=== fnProcessPinState source ===");
    const procSrc = await page.evaluate(`(function() {
      return typeof fnProcessPinState === 'function' ? fnProcessPinState.toString() : 'NOT_FOUND';
    })()`);
    console.log(procSrc);

    console.log("\nCalling fnLoginPin()...");
    try {
      await page.evaluate(`fnLoginPin()`);
    } catch (e: unknown) {
      console.log("fnLoginPin error:", (e as Error).message);
    }

    await page.waitForTimeout(15000);
    
    console.log("\n=== Network Activity ===");
    for (const entry of networkLog) {
      console.log(entry);
    }
    
    console.log("\nFinal URL:", page.url());
    await page.screenshot({ path: "diag-v3-final.png" });
  }

  await browser.close();
  console.log("\nDone.");
}

main().catch(console.error);
