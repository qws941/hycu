import { chromium } from 'playwright';

const OAUTH_URL = process.env.OAUTH_URL!;
const EMAIL = 'qws941@kakao.com';
const PASSWORD = process.env.CF_PASSWORD!;

if (!PASSWORD) {
  console.error('CF_PASSWORD env var is empty or not set');
  process.exit(1);
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'Asia/Seoul',
  });
  const page = await ctx.newPage();

  // Mask webdriver
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // @ts-ignore
    delete navigator.__proto__.webdriver;
  });

  console.log('Navigating...');
  await page.goto(OAUTH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log('URL:', page.url());

  // Use type() instead of fill() — React SPA needs real keyboard events
  await page.click('#email');
  await page.type('#email', EMAIL, { delay: 30 });
  await page.click('#password');
  await page.type('#password', PASSWORD, { delay: 30 });
  await page.waitForTimeout(500);
  console.log('Typed credentials (keystroke simulation)');

  // Click Turnstile checkbox inside iframe
  console.log('Looking for Turnstile iframe...');
  await page.waitForTimeout(2000);

  const turnstileFrame = page.frames().find(f => f.url().includes('challenges.cloudflare.com'));
  if (turnstileFrame) {
    console.log('Found Turnstile iframe:', turnstileFrame.url().substring(0, 80));
    try {
      // Click the checkbox/body area of the challenge
      const checkbox = await turnstileFrame.$('input[type="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        console.log('Clicked Turnstile checkbox');
      } else {
        // Some Turnstile versions use a div click target
        await turnstileFrame.click('body', { position: { x: 28, y: 28 } });
        console.log('Clicked Turnstile body area');
      }
    } catch (e: any) {
      console.log('Turnstile click failed:', e.message);
    }
  } else {
    console.log('No Turnstile iframe found. Frames:', page.frames().map(f => f.url().substring(0, 60)));
  }

  // Poll for Turnstile resolution via hidden field
  console.log('Waiting for Turnstile to resolve...');
  let resolved = false;
  for (let i = 0; i < 45; i++) {
    // Check any hidden input with turnstile/challenge response
    const val = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="hidden"]');
      for (const inp of inputs) {
        const el = inp as HTMLInputElement;
        if (el.name?.includes('cf') && el.value?.length > 10) return el.value;
        if (el.name?.includes('turnstile') && el.value?.length > 10) return el.value;
      }
      return '';
    }).catch(() => '');

    if (val.length > 10) {
      console.log(`Turnstile resolved after ${(i+1)*2}s (token len=${val.length})`);
      resolved = true;
      break;
    }

    // Re-click turnstile every 10s in case it needs interaction
    if (i > 0 && i % 5 === 0 && turnstileFrame) {
      try {
        await turnstileFrame.click('body', { position: { x: 28, y: 28 } });
        console.log(`  Re-clicked Turnstile at ${(i+1)*2}s`);
      } catch {}
    }

    await page.waitForTimeout(2000);
  }

  if (!resolved) {
    // Check if submit button is already enabled despite no token found
    const btnEnabled = await page.$eval('button[type="submit"]', (b: HTMLButtonElement) => !b.disabled).catch(() => false);
    if (btnEnabled) {
      console.log('Submit button is enabled, proceeding without token detection');
      resolved = true;
    } else {
      console.log('Turnstile did NOT resolve after 90s');
      await page.screenshot({ path: '/tmp/cf-turnstile-fail.png', fullPage: true });
      console.log('Screenshot: /tmp/cf-turnstile-fail.png');
      await browser.close();
      process.exit(1);
    }
  }

  // Submit
  const submitBtn = await page.$('button[type="submit"]');
  if (submitBtn) {
    await submitBtn.click({ timeout: 5000 });
    console.log('Clicked Log in');
  } else {
    await page.$eval('form', (f: HTMLFormElement) => f.submit());
    console.log('Form submitted directly');
  }

  // Wait for navigation after login
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/cf-post-login.png', fullPage: true });
  console.log('After login URL:', page.url());

  // Check for login error messages
  const errorMsg = await page.evaluate(() => {
    const errorEl = document.querySelector('[data-testid="login-error"], .error, [role="alert"], .notification-error, .text-error');
    return errorEl?.textContent?.trim() || '';
  }).catch(() => '');
  if (errorMsg) console.log('Login error:', errorMsg);

  // Log page content for debugging
  const bodyText = await page.textContent('body').catch(() => '');
  console.log('Page text (first 500):', bodyText?.substring(0, 500));

  // Check if we landed on a 2FA/MFA page
  const has2fa = await page.$('input[name="code"], input[placeholder*="code"], input[name="otp"]').catch(() => null);
  if (has2fa) {
    console.log('2FA/MFA page detected — cannot proceed automatically');
    await browser.close();
    process.exit(1);
  }

  // Check for authorize/consent page
  const authBtn = await page.$('button:has-text("Allow"), button:has-text("Authorize"), button:has-text("Approve")');
  if (authBtn) {
    await authBtn.click();
    console.log('Clicked authorize');
    await page.waitForTimeout(5000);
  }

  // Wait for localhost redirect (wrangler callback)
  if (!page.url().includes('localhost')) {
    try {
      await page.waitForURL('**/localhost**', { timeout: 15000 });
    } catch {}
  }

  console.log('Final URL:', page.url());
  if (page.url().includes('localhost')) {
    console.log('SUCCESS!');
  } else {
    await page.screenshot({ path: '/tmp/cf-final.png', fullPage: true });
    console.log('FAILED - screenshot: /tmp/cf-final.png');
    const body = await page.textContent('body');
    console.log('Body:', body?.substring(0, 400));
  }

  await browser.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
