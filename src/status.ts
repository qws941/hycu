import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

const ROAD = config.urls.road;
const LMS = config.urls.lms;
const USER_NO = config.userId;
const YEAR = "2026";
const SEMESTER = "10";

interface CourseProgress {
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
 * 3. Call LMS APIs to get course list and progress
 * 4. Display formatted status table
 */
export async function status(): Promise<void> {
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
      return;
    }
    console.log(`[status] LMS token acquired (${token.length} chars)`);

    // Fetch course list
    const courses = await fetchCourseList(token);
    if (courses.length === 0) {
      console.log("[status] no courses found for current semester");
      await saveCookies(context);
      await context.browser()?.close();
      return;
    }

    // Fetch progress for each course
    const progress = await fetchProgress(token, courses);

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
  } catch (err) {
    console.error("[status] failed:", err);
  } finally {
    await context.browser()?.close();
  }
}

/**
 * Fetch LMS session token from road.hycu.ac.kr.
 * POST /pot/MainCtr/findToken.do with gubun=lms returns a hex token string.
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
      return text.trim();
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
 * Fetch enrolled course list from LMS API.
 */
async function fetchCourseList(
  token: string,
): Promise<Array<{ crsCreCd: string; name: string }>> {
  try {
    const params = new URLSearchParams({
      token,
      userNo: USER_NO,
      year: YEAR,
      semester: SEMESTER,
    });
    const url = `${LMS}/api/wholeNoticeLessionList.do?${params}`;
    const resp = await fetch(url);
    const data = (await resp.json()) as Record<string, unknown>;

    // API returns { list: [...] } or similar structure
    const list = Array.isArray(data)
      ? data
      : Array.isArray(data.list)
        ? (data.list as Array<Record<string, unknown>>)
        : Array.isArray(data.result)
          ? (data.result as Array<Record<string, unknown>>)
          : [];

    const seen = new Set<string>();
    return list
      .filter((item: Record<string, unknown>) => {
        const code = String(item.crsCreCd || item.crsCd || "");
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((item: Record<string, unknown>) => ({
        crsCreCd: String(item.crsCreCd || item.crsCd || ""),
        name: String(item.crsNm || item.lessonNm || item.name || "Unknown"),
      }));
  } catch (err) {
    console.error("[status] course list fetch failed:", err);
    return [];
  }
}

/**
 * Fetch progress for each course.
 */
async function fetchProgress(
  token: string,
  courses: Array<{ crsCreCd: string; name: string }>,
): Promise<CourseProgress[]> {
  const results: CourseProgress[] = [];

  for (const course of courses) {
    try {
      const params = new URLSearchParams({
        token,
        userNo: USER_NO,
        crsCreCd: course.crsCreCd,
        progressType: "C",
      });
      const url = `${LMS}/api/selectStdProgressRatio.do?${params}`;
      const resp = await fetch(url);
      const data = (await resp.json()) as Record<string, unknown>;

      results.push({
        name: course.name,
        crsCreCd: course.crsCreCd,
        progressRatio: Number(data.progressRatio || data.prgrRatio || 0),
        attendCount: Number(data.attendCount || data.atndCnt || 0),
        totalCount: Number(data.totalCount || data.totalCnt || 0),
      });
    } catch {
      results.push({
        name: course.name,
        crsCreCd: course.crsCreCd,
        progressRatio: 0,
        attendCount: 0,
        totalCount: 0,
      });
    }
  }

  return results;
}
