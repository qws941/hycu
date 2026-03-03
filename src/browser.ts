import { chromium, type BrowserContext } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { config } from "./config.js";

/**
 * Launch browser with persisted cookie state.
 * If a saved session exists and is still valid, reuse it.
 */
export async function createBrowserContext(): Promise<BrowserContext> {
  mkdirSync(config.paths.cookies, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  // Restore cookies if saved
  if (existsSync(config.paths.cookieFile)) {
    try {
      const raw = await readFile(config.paths.cookieFile, "utf-8");
      const cookies = JSON.parse(raw);
      await context.addCookies(cookies);
      console.log("[browser] restored saved cookies");
    } catch {
      console.log("[browser] no valid saved cookies, starting fresh");
    }
  }

  return context;
}

/**
 * Save current browser cookies for session reuse.
 */
export async function saveCookies(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  await writeFile(config.paths.cookieFile, JSON.stringify(cookies, null, 2));
  console.log(`[browser] saved ${cookies.length} cookies`);
}
