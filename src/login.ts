import { type BrowserContext, type Page } from "playwright";
import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

/**
 * Perform SSO login via FIDO/PIN method.
 *
 * Flow:
 * 1. Navigate to road.hycu.ac.kr (redirects to SSO)
 * 2. Inject keyStore into localStorage (MagicSA reads from localStorage, not cookies)
 * 3. Select PIN login → enter PIN → browser JS handles FIDO signing
 * 4. SAML redirects complete → landed on road.hycu.ac.kr main
 */
export async function login(): Promise<void> {
  const context = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Step 1: Navigate to road.hycu.ac.kr — triggers SSO redirect
    console.log("[login] navigating to road.hycu.ac.kr...");
    await page.goto(`${config.urls.road}/`, { waitUntil: "networkidle" });
    console.log("[login] page loaded:", page.url());
    // Step 2: Check if already logged in
    if (await isLoggedIn(page)) {
      console.log("[login] already logged in, saving cookies");
      await saveCookies(context);
      await context.browser()?.close();
      return;
    }

    // Step 3: Inject keyStore into localStorage (must be on SSO origin first)
    await injectKeyStoreToLocalStorage(page);
    console.log("[login] keyStore injected into localStorage");

    // Step 4: Handle SSO login page
    await performFidoPinLogin(page);

    // Step 5: Wait for SAML redirects to complete and land on road.hycu.ac.kr
    await waitForLoginCompletion(page);
    // Step 6: Save cookies for session reuse
    await saveCookies(context);
    console.log("[login] login complete");
  } catch (err) {
    console.error("[login] failed:", err);
    // Take screenshot for debugging
    await page.screenshot({ path: "login-error.png" }).catch(() => {});
    console.log("[login] screenshot saved to login-error.png");
    console.log("[login] current URL:", page.url());
    throw err;
  } finally {
    await context.browser()?.close();
  }
}

/**
 * Inject FIDO keyStore into browser localStorage.
 * MagicSA library stores/reads the keyStore from localStorage under
 * the key "dreamsecurity/magicsa/keyStore", NOT from cookies.
 * Must be called after navigating to SSO origin.
 */
async function injectKeyStoreToLocalStorage(page: Page): Promise<void> {
  const keyStoreJson = config.fido.keyStoreJson;
  await page.evaluate((ks: string) => {
    localStorage.setItem('dreamsecurity/magicsa/keyStore', ks);
  }, keyStoreJson);
}

/**
 * Check if user is already logged in on road.hycu.ac.kr.
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  // If we're on road.hycu.ac.kr (not SSO/IDP redirect), we're logged in
  if (url.includes("road.hycu.ac.kr") && !url.includes("sso") && !url.includes("CreateRequest")) {
    return true;
  }
  return false;
}

/**
 * Perform FIDO/PIN login on the SSO page.
 *
 * Correct login flow (from data/login.js analysis):
 *   1. keyStore is already injected into localStorage (done in prior step)
 *   2. Call fnDefaultPinLoginForm() — reads keyStore, extracts keyId,
 *      POSTs to /sso/MyCertCtr/findPinInfoCnt.do, if count==1 shows #loginForm
 *   3. Set #pinNo value via JS (bypass readonly virtual keyboard)
 *   4. Click #pinLoginBtn (calls fnLoginPin → MagicSA decrypts keyStore
 *      with PIN → FIDO auth → sets #loginIdPin → submits form)
 *
 * WARNING: Do NOT call fnStartPinReg() — that is the registration flow
 *          which triggers PASS/kmcert mobile verification popup.
 */
async function performFidoPinLogin(page: Page): Promise<void> {
  console.log("[login] on SSO page:", page.url());

  // Wait for login page JS to fully initialize
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "login-page.png" });
  console.log("[login] login page screenshot saved");

  // Step 1: Call fnDefaultPinLoginForm() to initiate PIN login
  // This function reads keyStore from localStorage, extracts keyId,
  // checks PIN registration status via server API, and shows #loginForm if registered.
  // Do NOT call fnStartPinReg — that triggers PASS mobile verification (registration flow).
  console.log("[login] calling fnDefaultPinLoginForm()...");
  await page.evaluate(() => {
    (window as any).fnDefaultPinLoginForm();
  });
  // Wait for the login form to appear (PIN is already registered)
  // #loginForm changes from display:none to display:block
  try {
    await page.locator('#loginForm').waitFor({ state: 'visible', timeout: 10_000 });
    console.log("[login] PIN login form (#loginForm) is now visible");
  } catch {
    // Check if register form appeared instead (PIN not registered)
    const regFormVisible = await page.locator('#registerForm').isVisible().catch(() => false);
    if (regFormVisible) {
      throw new Error("PIN is not registered for this account. Register PIN manually first.");
    }
    await page.screenshot({ path: "login-no-pin-form.png" });
    throw new Error("Neither login form nor register form appeared after fnDefaultPinLoginForm");
  }

  // Step 4: Set PIN value in #pinNo
  // The input is readonly with a virtual keyboard — bypass by setting value directly via JS
  const pin = config.fido.pin;
  console.log("[login] setting PIN in #pinNo...");
  await page.evaluate((pinValue: string) => {
    const pinInput = document.getElementById('pinNo') as HTMLInputElement;
    if (!pinInput) throw new Error('#pinNo not found');
    // Remove readonly to allow value setting
    pinInput.removeAttribute('readonly');
    pinInput.value = pinValue;
    // Trigger input events so any JS listeners pick up the change
    pinInput.dispatchEvent(new Event('input', { bubbles: true }));
    pinInput.dispatchEvent(new Event('change', { bubbles: true }));
    // Restore readonly
    pinInput.setAttribute('readonly', 'readonly');
  }, pin);
  console.log("[login] PIN set in #pinNo");

  await page.screenshot({ path: "login-before-submit.png" });

  // Step 5: Click login button (#pinLoginBtn)
  // This calls fnLoginPin() which:
  //   - Gets PIN value from #pinNo
  //   - Uses MagicSA to decrypt keyStore cookie with PIN
  //   - Performs FIDO authentication (challenge → sign → verify)
  //   - Sets #loginIdPin value and submits form#loginFormPin
  //   - Form POSTs to /sso/AuthCtr/createRequestPIN.do → SAML flow
  const loginBtn = page.locator('#pinLoginBtn');
  await loginBtn.waitFor({ state: 'visible', timeout: 5000 });
  console.log("[login] clicking #pinLoginBtn...");
  await loginBtn.click();
  console.log("[login] login button clicked, waiting for FIDO auth + SAML...");
}

/**
 * Wait for SAML redirects to complete after FIDO auth.
 * The flow bounces: SSO → IDP → SSO → road.hycu.ac.kr
 */
async function waitForLoginCompletion(page: Page): Promise<void> {
  console.log("[login] waiting for SAML redirect flow...");

  // Wait until we land on road.hycu.ac.kr main page
  try {
    await page.waitForURL("**/road.hycu.ac.kr/**", {
      timeout: 30_000,
      waitUntil: "networkidle",
    });
    console.log("[login] landed on:", page.url());

    // Additional wait for any post-login initialization
    await page.waitForLoadState("networkidle");

    // Verify we're actually logged in
    if (page.url().includes("road.hycu.ac.kr")) {
      console.log("[login] successfully redirected to road.hycu.ac.kr");
    } else {
      throw new Error(`Unexpected URL after login: ${page.url()}`);
    }
  } catch (err) {
    await page.screenshot({ path: "login-redirect-error.png" });
    console.log("[login] redirect timeout. Current URL:", page.url());
    throw err;
  }
}
