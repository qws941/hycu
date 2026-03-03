import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

const ROAD = config.urls.road;
const LMS = config.urls.lms;
const USER_NO = config.userId;
const YEAR = "2026";
const SEMESTER = "10";

export interface CourseProgress {
  name: string;
  crsCreCd: string;
  progressRatio: number;
  attendCount: number;
  totalCount: number;
}

/**
 * Show current lecture/attendance status.
 *
 * 1. Open browser with saved session cookies
 * 2. Fetch LMS token via road.hycu.ac.kr/pot/MainCtr/findToken.do
 * 3. Call selectStdProgressRatio.do to get courses + progress in one call
 * 4. Display formatted status table
 */
export async function status(): Promise<CourseProgress[]> {
  console.log("[status] HYCU LMS Status");
  console.log(`  User: ${USER_NO} (${config.userName})
`);

  const context = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Navigate to main page to validate session
    await page.goto(`${ROAD}/pot/MainCtr/mainView.do`, {
      waitUntil: "networkidle",
    });

    if (
      page.url().includes("sso.hycu.ac.kr") ||
      page.url().includes("Login")
    ) {
      console.log("[status] session expired — run 'login' first");
      await context.browser()?.close();
      process.exit(1);
    }

    // Get LMS token
    const token = await fetchLmsToken(page);
    if (!token) {
      console.log("[status] failed to fetch LMS token");
      await context.browser()?.close();
      return [];
    }
    console.log(`[status] LMS token acquired (${token.length} chars)`);

    // Fetch courses + progress in one call
    const progress = await fetchCoursesWithProgress(page, token);
    if (progress.length === 0) {
      console.log('[status] no courses found for current semester');
      await saveCookies(context);
      await context.browser()?.close();
      return [];
    }

    // Display results
    console.log("\n" + "=".repeat(70));
    console.log(
      `  ${"".padEnd(35)} ${"".padStart(8, " ")}Progress  Attended`,
    );
    console.log("=".repeat(70));

    for (const p of progress) {
      const name = p.name.length > 35 ? p.name.substring(0, 32) + "..." : p.name;
      const ratio = `${p.progressRatio}%`.padStart(5);
      const count = `${p.attendCount}/${p.totalCount}`;
      console.log(`  ${name.padEnd(35)} ${ratio}     ${count}`);
    }
    console.log("=".repeat(70));

    await saveCookies(context);
    return progress;
  } catch (err) {
    console.error("[status] failed:", err);
    return [];
  } finally {
    await context.browser()?.close();
  }
}

/**
 * Fetch LMS session token from road.hycu.ac.kr.
 * POST /pot/MainCtr/findToken.do with gubun=lms returns a hex token string.
 * Must run inside page.evaluate() to include browser cookies.
 */
async function fetchLmsToken(
  page: import("playwright").Page,
): Promise<string | null> {
  try {
    const result = await page.evaluate(async (road) => {
      const fd = new URLSearchParams();
      fd.append("gubun", "lms");
      const resp = await fetch(`${road}/pot/MainCtr/findToken.do`, {
        method: "POST",
        body: fd,
      });
      const text = await resp.text();
      try {
        const json = JSON.parse(text.trim()) as Record<string, unknown>;
        return String(json.token || text.trim());
      } catch {
        return text.trim();
      }
    }, ROAD);

    if (result && result.length > 20) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch enrolled courses with progress from LMS API.
 * selectStdProgressRatio.do returns both course list and progress in one call.
 * HAR-verified params: year, semester, userNo, progressType=C, token
 * Response fields: crsCreNm (name), progRatio (progress %), corsUrl (contains crsCreCd),
 *   totWeekCnt, declsNo, userNo
 */
async function fetchCoursesWithProgress(
  page: import('playwright').Page,
  token: string,
): Promise<CourseProgress[]> {
  try {
    const result = await page.evaluate(
      async ({ lms, userNo, year, semester, tk }) => {
        const qs = new URLSearchParams({
          year,
          semester,
          userNo,
          progressType: 'C',
          token: tk,
        });
        const res = await fetch(`${lms}/api/selectStdProgressRatio.do?${qs}`, {
          headers: {
            accept: 'application/json, text/javascript, */*; q=0.01',
            'content-type': 'application/x-www-form-urlencoded',
          },
          credentials: 'omit',
        });
        const text = await res.text();
        return { status: res.status, url: res.url, body: text };
      },
      { lms: LMS, userNo: USER_NO, year: YEAR, semester: SEMESTER, tk: token },
    );

    if (result.body.trimStart().startsWith('<')) {
      console.error('[status] progress API returned HTML (status=%d url=%s)', result.status, result.url);
      console.error('[status] first 300 chars:', result.body.slice(0, 300));
      return [];
    }

    const data = JSON.parse(result.body) as Record<string, unknown>;
    const returnList = Array.isArray(data.returnList)
      ? (data.returnList as Array<Record<string, unknown>>)
      : [];

    return returnList
      .map((item) => {
        // Extract crsCreCd from corsUrl: '/crs/crsHomeStd.do?crsCreCd=202610CCP06401'
        const corsUrl = String(item.corsUrl || '');
        const crsCreCdMatch = corsUrl.match(/crsCreCd=([^&]+)/);
        const crsCreCd = crsCreCdMatch ? crsCreCdMatch[1] : '';
        return {
          name: String(item.crsCreNm || ''),
          crsCreCd,
          progressRatio: Number(item.progRatio || 0),
          attendCount: 0, // not in this API response
          totalCount: Number(item.totWeekCnt || 0),
        };
      })
      .filter((c) => c.crsCreCd);
  } catch (err) {
    console.error('[status] course+progress fetch failed:', err);
    return [];
  }
}
