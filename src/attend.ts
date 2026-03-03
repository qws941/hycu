import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

/**
 * Attend pending lectures.
 *
 * Flow:
 * 1. Open browser with saved session
 * 2. Navigate to LMS lecture list
 * 3. Find unattended lectures
 * 4. Open each lecture and watch/attend
 * 5. Verify attendance recorded
 *
 * TODO: Implement after exploring the actual lecture viewing flow
 * via the explore command. The HAR only captured dashboard APIs,
 * not the lecture player/attendance recording endpoints.
 */
export async function attend(): Promise<void> {
  const context = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Navigate to road.hycu.ac.kr to check session
    await page.goto(`${config.urls.road}/`, { waitUntil: "networkidle" });

    const url = page.url();
    if (url.includes("sso.hycu.ac.kr") || url.includes("Login")) {
      console.log("[attend] session expired — run 'login' command first");
      await context.browser()?.close();
      process.exit(1);
    }

    console.log("[attend] logged in, navigating to lectures...");

    // Navigate to lecture list page
    // road.hycu.ac.kr likely has a lecture/class list page
    await page.goto(`${config.urls.road}/pot/MainCtr/mainView.do`, {
      waitUntil: "networkidle",
    });

    await page.screenshot({ path: "attend-main.png" });
    console.log("[attend] main page screenshot saved to attend-main.png");

    // TODO: Explore and implement the actual lecture attendance flow
    // Need to discover:
    // 1. Where lecture list is shown
    // 2. How to navigate to individual lectures
    // 3. What constitutes "attendance" (video player? page visit?)
    // 4. How attendance is recorded (API call? time spent?)

    console.log("[attend] attendance automation not yet implemented");
    console.log("[attend] run with headed browser to explore the lecture flow");

    // Save any updated cookies
    await saveCookies(context);
  } catch (err) {
    console.error("[attend] failed:", err);
    await page.screenshot({ path: "attend-error.png" }).catch(() => {});
    throw err;
  } finally {
    await context.browser()?.close();
  }
}
