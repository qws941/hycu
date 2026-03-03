/**
 * Focused SSO diagnostic: check magicsa.getKeyStore(), form visibility,
 * and try manual login flow.
 */
import { chromium } from "playwright";
import { config } from "../src/config.js";

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: "ko-KR", timezoneId: "Asia/Seoul" });

  // Inject keyStore cookie
  await context.addCookies([{
    name: "dreamsecurity/magicsa/keyStore",
    value: config.fido.keyStoreJson,
    domain: ".hycu.ac.kr",
    path: "/",
  }]);
  console.log("[diag] keyStore cookie injected");

  const page = await context.newPage();

  // Navigate directly to SSO
  await page.goto("https://sso.hycu.ac.kr/", { waitUntil: "networkidle", timeout: 30000 });
  console.log("[diag] URL:", page.url());

  // Check 1: What does magicsa.getKeyStore() return?
  const ksResult = await page.evaluate("(function() { try { return { ks: magicsa.getKeyStore(), type: typeof magicsa.getKeyStore() }; } catch(e) { return { error: e.message }; } })()");
  console.log("\n=== magicsa.getKeyStore() ===");
  console.log(JSON.stringify(ksResult, null, 2));

  // Check 2: Form visibility states
  const formState = await page.evaluate(`(function() {
    return {
      authForm: document.getElementById('authForm')?.style.display,
      registerForm: document.getElementById('registerForm')?.style.display,
      loginForm: document.getElementById('loginForm')?.style.display,
      pinBtn: document.getElementById('pinBtn')?.style.display,
      regPinBtn: document.getElementById('regPinBtn')?.style.display,
      loginPinBtn: document.getElementById('loginPinBtn')?.style.display,
      pinNoValue: document.getElementById('pinNo')?.value,
      loginIdPinValue: document.getElementById('loginIdPin')?.value,
      authRegPinValue: document.getElementById('authRegPin')?.value,
    };
  })()`);
  console.log("\n=== Form Visibility ===");
  console.log(JSON.stringify(formState, null, 2));

  // Check 3: Try calling fnDefaultPinLoginForm() manually
  console.log("\n=== Calling fnDefaultPinLoginForm() ===");
  const defaultResult = await page.evaluate(`(function() {
    try {
      fnDefaultPinLoginForm();
      return {
        success: true,
        authForm: document.getElementById('authForm')?.style.display,
        registerForm: document.getElementById('registerForm')?.style.display,
        loginForm: document.getElementById('loginForm')?.style.display,
        pinBtn: document.getElementById('pinBtn')?.style.display,
        loginPinBtn: document.getElementById('loginPinBtn')?.style.display,
      };
    } catch(e) {
      return { error: e.message, stack: e.stack?.substring(0, 200) };
    }
  })()`);
  console.log(JSON.stringify(defaultResult, null, 2));

  // Check 4: Try manually showing login form and setting PIN
  console.log("\n=== Manual Login Form Activation ===");
  const manualResult = await page.evaluate(`(function() {
    try {
      // Show login form, hide auth form
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('loginForm').style.display = 'block';
      document.getElementById('pinBtn').style.display = 'none';
      document.getElementById('loginPinBtn').style.display = 'block';
      
      // Set loginIdPin (hidden field used by fnLoginPin)
      document.getElementById('loginIdPin').value = '2024112536';
      
      return {
        success: true,
        loginFormDisplay: document.getElementById('loginForm')?.style.display,
        loginPinBtnDisplay: document.getElementById('loginPinBtn')?.style.display,
        loginIdPinValue: document.getElementById('loginIdPin')?.value,
        pinNoReadonly: document.getElementById('pinNo')?.readOnly,
        pinNoMaxLength: document.getElementById('pinNo')?.maxLength,
      };
    } catch(e) {
      return { error: e.message };
    }
  })()`);
  console.log(JSON.stringify(manualResult, null, 2));

  // Check 5: Set PIN value (bypass readonly) and try fnLoginPin
  console.log("\n=== Setting PIN and calling fnLoginPin() ===");
  
  // Set PIN value bypassing readonly
  await page.evaluate(`(function() {
    var pinInput = document.getElementById('pinNo');
    pinInput.removeAttribute('readonly');
    pinInput.value = '${config.fido.pin}';
    pinInput.setAttribute('readonly', 'readonly');
  })()`);
  
  const pinSet = await page.evaluate(`(function() {
    return {
      pinNoValue: document.getElementById('pinNo')?.value,
      pinNoLength: document.getElementById('pinNo')?.value?.length,
    };
  })()`);
  console.log("PIN set:", JSON.stringify(pinSet));

  // Screenshot before login attempt
  await page.screenshot({ path: "diag-before-login.png" });
  console.log("Screenshot saved: diag-before-login.png");

  // Listen for network activity
  const networkLog: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("hycu.ac.kr") || req.url().includes("MagicMOA") || req.url().includes("MagicFIDO")) {
      networkLog.push(`REQ: ${req.method()} ${req.url().substring(0, 120)}`);
    }
  });
  page.on("response", (res) => {
    if (res.url().includes("hycu.ac.kr") || res.url().includes("MagicMOA") || res.url().includes("MagicFIDO")) {
      networkLog.push(`RES: ${res.status()} ${res.url().substring(0, 120)}`);
    }
  });

  // Now call fnLoginPin() — this should trigger FIDO auth
  console.log("\nCalling fnLoginPin()...");
  try {
    const loginResult = await page.evaluate(`(function() {
      try {
        fnLoginPin();
        return { called: true };
      } catch(e) {
        return { error: e.message, stack: e.stack?.substring(0, 300) };
      }
    })()`);
    console.log("fnLoginPin result:", JSON.stringify(loginResult));
  } catch (e: unknown) {
    console.log("fnLoginPin error:", (e as Error).message);
  }

  // Wait for network activity
  console.log("\nWaiting 10s for FIDO/SAML network activity...");
  await page.waitForTimeout(10000);

  console.log("\n=== Network Log ===");
  for (const entry of networkLog) {
    console.log(entry);
  }

  // Check final state
  const finalUrl = page.url();
  console.log("\n=== Final State ===");
  console.log("URL:", finalUrl);
  
  await page.screenshot({ path: "diag-after-login.png" });
  console.log("Screenshot saved: diag-after-login.png");

  // Check if we got a dialog/alert
  const finalFormState = await page.evaluate(`(function() {
    return {
      url: window.location.href,
      title: document.title,
      loginIdPin: document.getElementById('loginIdPin')?.value,
    };
  })()`).catch(() => ({ error: "page navigated" }));
  console.log("Final form:", JSON.stringify(finalFormState));

  await browser.close();
  console.log("\nDone.");
}

main().catch(console.error);
