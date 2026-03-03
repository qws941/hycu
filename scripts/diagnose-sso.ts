/**
 * Diagnose SSO PIN login state.
 * Checks: keyStore cookie visibility, MagicSA state, form visibility,
 * fnDefaultPinLoginForm behavior, and attempts manual login form activation.
 */
import { chromium } from "playwright";
import { config } from "../src/config.js";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
  });

  // Inject keyStore cookie (same as login.ts)
  await context.addCookies([
    {
      name: "dreamsecurity/magicsa/keyStore",
      value: config.fido.keyStoreJson,
      domain: ".hycu.ac.kr",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  console.log("[diag] keyStore cookie injected");

  const page = await context.newPage();
  
  // Also try setting cookie for sso.hycu.ac.kr specifically
  await context.addCookies([
    {
      name: "dreamsecurity/magicsa/keyStore",
      value: config.fido.keyStoreJson,
      domain: "sso.hycu.ac.kr",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Navigate to SSO directly (skip road.hycu.ac.kr redirect)
  console.log("[diag] navigating to sso.hycu.ac.kr...");
  await page.goto("https://sso.hycu.ac.kr/", { waitUntil: "networkidle", timeout: 30000 });
  console.log("[diag] URL:", page.url());

  // Diagnostic 1: Check cookies visible to page JS
  const cookieCheck = await page.evaluate(() => {
    return {
      allCookies: document.cookie,
      hasKeyStore: document.cookie.includes("keyStore"),
      cookieLength: document.cookie.length,
    };
  });
  console.log("\n=== COOKIE CHECK ===");
  console.log(JSON.stringify(cookieCheck, null, 2));

  // Diagnostic 2: Check MagicSA state
  const magicsaCheck = await page.evaluate(() => {
    const w = window as any;
    return {
      hasMagicSA: typeof w.MagicSA !== "undefined",
      hasMagicsaInstance: typeof w.magicsa !== "undefined",
      magicsaType: typeof w.magicsa,
      magicsaMethods: w.magicsa ? Object.getOwnPropertyNames(Object.getPrototypeOf(w.magicsa)).filter((m: string) => typeof w.magicsa[m] === 'function') : [],
      magicsaKeyName: w.magicsa?.keyName || w.magicsa?._keyName || "unknown",
      hasFnDefaultPinLoginForm: typeof w.fnDefaultPinLoginForm === "function",
      hasFnLoginPin: typeof w.fnLoginPin === "function",
      hasFnStartPinReg: typeof w.fnStartPinReg === "function",
      hasFnProcessPinState: typeof w.fnProcessPinState === "function",
      hasFnCheckPinState: typeof w.fnCheckPinState === "function",
      hasFnOpenVitualKeyboard: typeof w.fnOpenVitualKeyboard === "function",
      hasFnCancelPinReg: typeof w.fnCancelPinReg === "function",
    };
  });
  console.log("\n=== MAGICSA CHECK ===");
  console.log(JSON.stringify(magicsaCheck, null, 2));

  // Diagnostic 3: Check form visibility
  const formCheck = await page.evaluate(() => {
    const getDisplay = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return "NOT_FOUND";
      return window.getComputedStyle(el).display;
    };
    return {
      authForm: getDisplay("authForm"),
      registerForm: getDisplay("registerForm"),
      loginForm: getDisplay("loginForm"),
      pinBtn: getDisplay("pinBtn"),
      regPinBtn: getDisplay("regPinBtn"),
      loginPinBtn: getDisplay("loginPinBtn"),
      authRegPinValue: (document.getElementById("authRegPin") as HTMLInputElement)?.value || "",
      loginIdPinValue: (document.getElementById("loginIdPin") as HTMLInputElement)?.value || "",
      pinNoValue: (document.getElementById("pinNo") as HTMLInputElement)?.value || "",
    };
  });
  console.log("\n=== FORM STATE (initial) ===");
  console.log(JSON.stringify(formCheck, null, 2));

  // Diagnostic 4: Try calling fnDefaultPinLoginForm()
  console.log("\n=== CALLING fnDefaultPinLoginForm() ===");
  const fnResult = await page.evaluate(() => {
    const w = window as any;
    if (typeof w.fnDefaultPinLoginForm === "function") {
      try {
        w.fnDefaultPinLoginForm();
        return { called: true, error: null };
      } catch (e: any) {
        return { called: false, error: e.message };
      }
    }
    return { called: false, error: "function not found" };
  });
  console.log(JSON.stringify(fnResult, null, 2));

  // Check form state after fnDefaultPinLoginForm
  const formCheck2 = await page.evaluate(() => {
    const getDisplay = (id: string) => {
      const el = document.getElementById(id);
      if (!el) return "NOT_FOUND";
      return window.getComputedStyle(el).display;
    };
    return {
      authForm: getDisplay("authForm"),
      registerForm: getDisplay("registerForm"),
      loginForm: getDisplay("loginForm"),
      pinBtn: getDisplay("pinBtn"),
      regPinBtn: getDisplay("regPinBtn"),
      loginPinBtn: getDisplay("loginPinBtn"),
    };
  });
  console.log("\n=== FORM STATE (after fnDefaultPinLoginForm) ===");
  console.log(JSON.stringify(formCheck2, null, 2));

  // Diagnostic 5: Check MagicSA keyStore detection
  console.log("\n=== MAGICSA KEYSTORE CHECK ===");
  const keyStoreCheck = await page.evaluate(() => {
    const w = window as any;
    if (!w.magicsa) return { error: "magicsa not initialized" };
    
    const result: any = {};
    
    // Try to check if keyStore exists via MagicSA methods
    try {
      if (typeof w.magicsa.isKeyStoreExist === "function") {
        result.isKeyStoreExist = w.magicsa.isKeyStoreExist();
      }
    } catch (e: any) { result.isKeyStoreExistError = e.message; }
    
    try {
      if (typeof w.magicsa.getKeyStore === "function") {
        const ks = w.magicsa.getKeyStore();
        result.keyStoreExists = ks !== null && ks !== undefined;
        result.keyStoreType = typeof ks;
        result.keyStoreLength = typeof ks === "string" ? ks.length : (ks ? JSON.stringify(ks).length : 0);
      }
    } catch (e: any) { result.getKeyStoreError = e.message; }

    try {
      if (typeof w.magicsa.getKeyInfo === "function") {
        result.keyInfo = w.magicsa.getKeyInfo();
      }
    } catch (e: any) { result.getKeyInfoError = e.message; }

    // Check localStorage for keyStore
    try {
      const lsKeys = Object.keys(localStorage);
      result.localStorageKeys = lsKeys.filter((k: string) => k.toLowerCase().includes("key") || k.toLowerCase().includes("magic") || k.toLowerCase().includes("dream") || k.toLowerCase().includes("fido"));
      
      // Check all localStorage for anything keyStore-related
      for (const key of lsKeys) {
        if (key.includes("keyStore") || key.includes("magicsa") || key.includes("dreamsecurity")) {
          result[`ls_${key}`] = localStorage.getItem(key)?.substring(0, 100);
        }
      }
    } catch (e: any) { result.localStorageError = e.message; }

    // Check IndexedDB for keyStore
    try {
      result.indexedDBDatabases = "checking...";
    } catch (e: any) { result.indexedDBError = e.message; }
    
    return result;
  });
  console.log(JSON.stringify(keyStoreCheck, null, 2));

  // Diagnostic 6: Try manually showing login form and checking state
  console.log("\n=== MANUAL LOGIN FORM ACTIVATION ===");
  const manualResult = await page.evaluate(() => {
    const w = window as any;
    
    // Manually show #loginForm, hide #authForm
    const loginForm = document.getElementById("loginForm");
    const authForm = document.getElementById("authForm");
    const loginPinBtn = document.getElementById("loginPinBtn");
    const pinBtn = document.getElementById("pinBtn");
    
    if (loginForm) loginForm.style.display = "block";
    if (authForm) authForm.style.display = "none";
    if (loginPinBtn) loginPinBtn.style.display = "block";
    if (pinBtn) pinBtn.style.display = "none";
    
    return {
      loginFormShown: loginForm?.style.display === "block",
      authFormHidden: authForm?.style.display === "none",
      loginPinBtnShown: loginPinBtn?.style.display === "block",
      pinNoExists: !!document.getElementById("pinNo"),
      pinLoginBtnExists: !!document.getElementById("pinLoginBtn"),
    };
  });
  console.log(JSON.stringify(manualResult, null, 2));

  await page.screenshot({ path: "diag-login-form.png" });
  console.log("[diag] screenshot saved: diag-login-form.png");

  // Diagnostic 7: Try setting PIN and calling fnLoginPin
  console.log("\n=== SETTING PIN AND CHECKING fnLoginPin ===");
  const pinSetResult = await page.evaluate((pin: string) => {
    const pinInput = document.getElementById("pinNo") as HTMLInputElement;
    if (!pinInput) return { error: "pinNo not found" };
    
    pinInput.removeAttribute("readonly");
    pinInput.value = pin;
    pinInput.dispatchEvent(new Event("input", { bubbles: true }));
    pinInput.dispatchEvent(new Event("change", { bubbles: true }));
    pinInput.setAttribute("readonly", "readonly");
    
    return {
      pinSet: true,
      pinValue: pinInput.value,
      pinLength: pinInput.value.length,
    };
  }, config.fido.pin);
  console.log(JSON.stringify(pinSetResult, null, 2));

  // Check if fnLoginPin can be called
  const loginPinCheck = await page.evaluate(() => {
    const w = window as any;
    if (typeof w.fnLoginPin !== "function") return { error: "fnLoginPin not found" };
    return { 
      fnLoginPinExists: true,
      fnLoginPinSource: w.fnLoginPin.toString().substring(0, 500),
    };
  });
  console.log("\n=== fnLoginPin source ===");
  console.log(JSON.stringify(loginPinCheck, null, 2));

  // Also check fnProcessPinState
  const processPinCheck = await page.evaluate(() => {
    const w = window as any;
    const fns = ["fnProcessPinState", "fnCheckPinState", "fnDefaultPinLoginForm", "fnLoginPin", "fnStartPinReg"];
    const result: any = {};
    for (const fn of fns) {
      if (typeof w[fn] === "function") {
        result[fn] = w[fn].toString().substring(0, 800);
      } else {
        result[fn] = "NOT_FOUND";
      }
    }
    return result;
  });
  console.log("\n=== PIN FUNCTION SOURCES ===");
  for (const [name, src] of Object.entries(processPinCheck)) {
    console.log(`\n--- ${name} ---`);
    console.log(src);
  }

  await browser.close();
  console.log("\n[diag] done.");
}

main().catch(console.error);
