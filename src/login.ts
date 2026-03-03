import { type BrowserContext, type Page } from "playwright";
import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

/**
 * Perform SSO login via FIDO/PIN method.
 *
 * Flow:
 * 1. Inject keyStore cookie for fido.hycu.ac.kr
 * 2. Navigate to road.hycu.ac.kr (redirects to SSO)
 * 3. Select PIN login → enter PIN → browser JS handles FIDO signing
 * 4. SAML redirects complete → landed on road.hycu.ac.kr main
 */
export async function login(): Promise<void> {
  const context = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Step 1: Inject FIDO keyStore cookie
    await injectKeyStoreCookie(context);
    console.log("[login] keyStore cookie injected");

    // Step 2: Navigate to road.hycu.ac.kr — triggers SSO redirect
    console.log("[login] navigating to road.hycu.ac.kr...");
    await page.goto(`${config.urls.road}/`, { waitUntil: "networkidle" });
    console.log("[login] page loaded:", page.url());

    // Step 3: Check if already logged in
    if (await isLoggedIn(page)) {
      console.log("[login] already logged in, saving cookies");
      await saveCookies(context);
      await context.browser()?.close();
      return;
    }

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
 * Inject the FIDO keyStore cookie into the browser context.
 * The keyStore holds the encrypted ECDSA private key needed for FIDO auth.
 */
async function injectKeyStoreCookie(context: BrowserContext): Promise<void> {
  const keyStoreJson = config.fido.keyStoreJson;

  // The keyStore cookie lives on sso.hycu.ac.kr (where MagicMOA JS reads it)
  await context.addCookies([
    {
      name: "dreamsecurity/magicsa/keyStore",
      value: keyStoreJson,
      domain: ".hycu.ac.kr",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}

/**
 * Check if user is already logged in on road.hycu.ac.kr.
 */
async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  // If we're on the main page (not SSO), we're logged in
  if (url.includes("road.hycu.ac.kr") && !url.includes("sso")) {
    // Verify by checking for user-specific elements
    const hasMainContent = await page
      .locator('[class*="main"], [class*="Main"], [id*="main"]')
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    return hasMainContent;
  }
  return false;
}

/**
 * Perform FIDO/PIN login on the SSO page.
 * - Select PIN login method (loginGbn=5)
 * - Enter PIN
 * - Submit → browser JS handles FIDO challenge signing
 */
async function performFidoPinLogin(page: Page): Promise<void> {
  console.log("[login] on SSO page:", page.url());

  // Wait for login page to load
  await page.waitForLoadState("networkidle");

  // Take a screenshot to debug what we see
  await page.screenshot({ path: "login-page.png" });
  console.log("[login] login page screenshot saved");

  // Try to find and click PIN/FIDO login tab
  // Common patterns: tab buttons, login method selectors
  const pinTabSelectors = [
    'text=PIN',
    'text=간편인증',
    'text=생체인증',
    '[data-login-gbn="5"]',
    'a[href*="pin"]',
    'button:has-text("PIN")',
    '.login_tab >> text=PIN',
    '#loginTab5',
    'li:has-text("PIN")',
  ];

  let clicked = false;
  for (const selector of pinTabSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        clicked = true;
        console.log(`[login] clicked PIN tab: ${selector}`);
        break;
      }
    } catch {
      // try next selector
    }
  }

  if (!clicked) {
    console.log("[login] could not find PIN tab, page may already be on PIN login");
    // Dump page content for debugging
    const html = await page.content();
    console.log("[login] page HTML length:", html.length);
    console.log("[login] page title:", await page.title());
  }

  await page.waitForTimeout(1000);

  // Enter PIN
  const pinInputSelectors = [
    'input[type="password"]',
    'input[name*="pin" i]',
    'input[id*="pin" i]',
    'input[placeholder*="PIN" i]',
    'input[placeholder*="비밀번호" i]',
    '#userPin',
    '#pinNo',
  ];

  let pinEntered = false;
  for (const selector of pinInputSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.fill(config.fido.pin);
        pinEntered = true;
        console.log(`[login] entered PIN in: ${selector}`);
        break;
      }
    } catch {
      // try next
    }
  }

  if (!pinEntered) {
    await page.screenshot({ path: "login-no-pin-input.png" });
    throw new Error("Could not find PIN input field");
  }

  // Click login/submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("로그인")',
    'button:has-text("Login")',
    'button:has-text("인증")',
    'a:has-text("로그인")',
    '#loginBtn',
    '.btn_login',
    '.login_btn',
  ];

  let submitted = false;
  for (const selector of submitSelectors) {
    try {
      const el = page.locator(selector).first();
      if (await el.isVisible({ timeout: 2000 })) {
        await el.click();
        submitted = true;
        console.log(`[login] clicked submit: ${selector}`);
        break;
      }
    } catch {
      // try next
    }
  }

  if (!submitted) {
    // Try pressing Enter as fallback
    await page.keyboard.press("Enter");
    console.log("[login] pressed Enter as submit fallback");
  }
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
