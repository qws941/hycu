import { type BrowserContext, type Page, type Response } from "playwright";
import { createBrowserContext, saveCookies } from "./browser.js";
import { config } from "./config.js";

interface CourseInfo {
  crsCreCd: string;
  name: string;
}

interface LessonSchedule {
  lessonScheduleId: string;
  lessonTimeId: string;
  lessonCntsId: string;
  title: string;
  pageCount: number;
  attended: boolean;
}

interface PageInfo {
  idx: number;
  lessonCntsId: string;
  videoTm: number; // seconds
  title: string;
}

const LMS = config.urls.lms;
const ROAD = config.urls.road;
const USER_NO = config.userId;
const YEAR = '2026';
const SEMESTER = '10';

/**
 * Attend pending lectures across all enrolled courses.
 *
 * Flow:
 * 1. Navigate to road.hycu.ac.kr main dashboard
 * 2. Discover enrolled courses
 * 3. For each course, find unattended lessons
 * 4. Open lecture view page, play video at 2×
 * 5. Send periodic saveStdyRecord.do (every 180s like real client)
 * 6. Wait for attendance confirmation (result=100)
 */
export async function attend(): Promise<void> {
  const context = await createBrowserContext();
  const page = await context.newPage();

  try {
    // Check session validity
    await page.goto(`${ROAD}/pot/MainCtr/mainView.do`, {
      waitUntil: "networkidle",
    });

    if (
      page.url().includes("sso.hycu.ac.kr") ||
      page.url().includes("Login")
    ) {
      console.log("[attend] session expired — run 'login' first");
      await context.browser()?.close();
      process.exit(1);
    }
    console.log("[attend] session valid");

    // Get LMS token and discover courses via API
    const token = await fetchLmsToken(page);
    const courses = await discoverCourses(page, token);
    if (courses.length === 0) {
      console.log("[attend] no courses found");
      await saveCookies(context);
      await context.browser()?.close();
      return;
    }

    for (const course of courses) {
      console.log(`
[attend] === ${course.name} (${course.crsCreCd}) ===`);
      await attendCourse(context, page, course);
    }

    await saveCookies(context);
    console.log("\n[attend] done");
  } catch (err) {
    console.error("[attend] failed:", err);
    await page.screenshot({ path: "attend-error.png" }).catch(() => {});
    throw err;
  } finally {
    await context.browser()?.close();
  }
}

/**
 * Fetch LMS auth token from road.hycu.ac.kr.
 */
async function fetchLmsToken(page: Page): Promise<string> {
  const raw = await page.evaluate(async (road) => {
    const res = await fetch(`${road}/pot/MainCtr/findToken.do`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'gubun=lms',
    });
    return res.text();
  }, ROAD);

  let token = raw.trim();
  try {
    const parsed = JSON.parse(token) as Record<string, unknown>;
    if (typeof parsed.token === 'string') token = parsed.token;
  } catch { /* plain text token */ }

  console.log(`[attend] LMS token acquired (${token.length} chars)`);
  return token;
}

/**
 * Discover enrolled courses via selectStdProgressRatio.do API.
 * Same endpoint used by status.ts — returns courses + progress in one call.
 */
async function discoverCourses(page: Page, token: string): Promise<CourseInfo[]> {
  const result = await page.evaluate(
    async ({ lms, userNo, year, semester, tk }) => {
      const qs = new URLSearchParams({
        year, semester, userNo,
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
      return res.text();
    },
    { lms: LMS, userNo: USER_NO, year: YEAR, semester: SEMESTER, tk: token },
  );

  try {
    const data = JSON.parse(result) as Record<string, unknown>;
    const list = Array.isArray(data.returnList)
      ? (data.returnList as Array<Record<string, unknown>>)
      : [];
    return list
      .map((item) => {
        const corsUrl = String(item.corsUrl || '');
        const match = corsUrl.match(/crsCreCd=([^&]+)/);
        return {
          crsCreCd: match ? match[1] : '',
          name: String(item.crsCreNm || ''),
        };
      })
      .filter((c) => c.crsCreCd);
  } catch {
    console.error('[attend] course API returned non-JSON:', result.slice(0, 200));
    return [];
  }
}

/**
 * Attend all unattended lessons in a course.
 */
async function attendCourse(
  context: BrowserContext,
  page: Page,
  course: CourseInfo,
): Promise<void> {
  // Navigate to course home to get lesson schedule
  await page.goto(
    `${LMS}/crs/crsHomeStd.do?crsCreCd=${course.crsCreCd}`,
    { waitUntil: "networkidle" },
  );

  const stdNo = `${course.crsCreCd}${USER_NO}`;

  // Get lesson schedules from the page
  const schedules = await getLessonSchedules(page, course.crsCreCd, stdNo);
  if (schedules.length === 0) {
    console.log("[attend] no lesson schedules found");
    return;
  }

  const pending = schedules.filter((s) => !s.attended);
  console.log(
    `[attend] ${schedules.length} lesson(s), ${pending.length} pending`,
  );

  for (const lesson of pending) {
    console.log(`
[attend] --- ${lesson.title} ---`);
    await attendLesson(context, page, course.crsCreCd, stdNo, lesson);
  }
}

/**
 * Get lesson schedules for a course by scraping the course home page.
 */
async function getLessonSchedules(
  page: Page,
  crsCreCd: string,
  stdNo: string,
): Promise<LessonSchedule[]> {
  // Try the API first
  const apiResult = await page.evaluate(
    async (params) => {
      try {
        const fd = new URLSearchParams();
        fd.append("crsCreCd", params.crsCreCd);
        fd.append("stdNo", params.stdNo);
        fd.append("userNo", params.userNo);
        const resp = await fetch("/crs/listCrsHomeLessonSchedule.do", {
          method: "POST",
          body: fd,
        });
        return await resp.json();
      } catch {
        return null;
      }
    },
    { crsCreCd, stdNo, userNo: USER_NO },
  );

  if (apiResult && Array.isArray(apiResult)) {
    return apiResult.map((item: Record<string, unknown>) => ({
      lessonScheduleId: String(item.lessonScheduleId || ""),
      lessonTimeId: String(item.lessonTimeId || ""),
      lessonCntsId: String(item.lessonCntsId || ""),
      title: String(item.lessonScheduleNm || item.title || "Lesson"),
      pageCount: Number(item.pageCnt || 1),
      attended: item.atndYn === "Y" || item.prgrRatio === 100,
    }));
  }

  // Fallback: scrape from page
  return page.evaluate(() => {
    const results: LessonSchedule[] = [];
    // Look for lesson rows/links in the course home
    const rows = document.querySelectorAll(
      "[data-lesson-schedule-id], tr[onclick*='lessonScheduleId'], .lesson-item, .lsn-item",
    );
    for (const row of rows) {
      const schedId =
        row.getAttribute("data-lesson-schedule-id") ||
        (row.getAttribute("onclick")?.match(
          /lessonScheduleId[=:,'\s]+(LS_\w+)/,
        )?.[1] ?? "");
      const timeId =
        row.getAttribute("data-lesson-time-id") ||
        (row.getAttribute("onclick")?.match(
          /lessonTimeId[=:,'\s]+(LT_\w+)/,
        )?.[1] ?? "");
      const cntsId =
        row.getAttribute("data-lesson-cnts-id") ||
        (row.getAttribute("onclick")?.match(
          /lessonCntsId[=:,'\s]+(LC_\w+)/,
        )?.[1] ?? "");
      if (schedId) {
        results.push({
          lessonScheduleId: schedId,
          lessonTimeId: timeId,
          lessonCntsId: cntsId,
          title: row.textContent?.trim().split("\n")[0]?.trim() || schedId,
          pageCount: 1,
          attended: row.textContent?.includes("완료") || false,
        });
      }
    }
    return results;
  });
}

/**
 * Attend a single lesson by opening the lecture view and simulating playback.
 */
async function attendLesson(
  _context: BrowserContext,
  page: Page,
  crsCreCd: string,
  stdNo: string,
  lesson: LessonSchedule,
): Promise<void> {
  // Navigate to lecture view page
  const viewUrl =
    `${LMS}/crs/crsStdLessonView.do` +
    `?crsCreCd=${crsCreCd}` +
    `&lessonScheduleId=${lesson.lessonScheduleId}` +
    `&lessonTimeId=${lesson.lessonTimeId}` +
    `&lessonCntsIdx=0`;

  console.log(`[attend] opening ${viewUrl}`);

  // Set window name (required by duplicate detection)
  await page.evaluate(() => {
    window.name = "LessonViewWindow_attend";
  });

  // Listen for saveStdyRecord responses
  let attendanceComplete = false;
  const recordListener = (response: Response) => {
    if (response.url().includes("saveStdyRecord.do")) {
      response
        .json()
        .then((data: Record<string, unknown>) => {
          const result = Number(data.result);
          console.log(`[attend] saveStdyRecord result=${result}`);
          if (result === 100) {
            attendanceComplete = true;
            console.log("[attend] ✓ attendance complete!");
          } else if (result < 0) {
            console.error(`[attend] error: result=${result}`);
          }
        })
        .catch(() => {});
    }
  };
  page.on("response", recordListener);

  try {
    await page.goto(viewUrl, { waitUntil: "networkidle", timeout: 30000 });

    // Extract page info from content XML embedded in page
    const pages = await extractPageInfo(page);
    console.log(`[attend] ${pages.length} content page(s) found`);

    // Process each content page
    for (let i = 0; i < pages.length; i++) {
      if (attendanceComplete) break;
      const pg = pages[i];
      console.log(
        `[attend] page ${i + 1}/${pages.length}: ${pg.title} (${pg.videoTm}s)`,
      );

      if (i > 0) {
        // Navigate to next page within the lesson viewer
        await navigateToPage(page, i);
      }

      // Start video playback at 2× speed
      await startPlayback(page);

      // Wait for this page's content to complete
      await waitForPageCompletion(page, pg, () => attendanceComplete);
    }

    if (attendanceComplete) {
      console.log(`[attend] ✓ ${lesson.title} — fully attended`);
    } else {
      console.log(`[attend] ${lesson.title} — playback finished (may need more time)`);
    }
  } finally {
    page.off("response", recordListener);
  }
}

/**
 * Extract content page info from the XML data embedded in the lecture view page.
 */
async function extractPageInfo(page: Page): Promise<PageInfo[]> {
  return page.evaluate(() => {
    const results: Array<{
      idx: number;
      lessonCntsId: string;
      videoTm: number;
      title: string;
    }> = [];

    // Look for embedded XML content data
    const scripts = document.querySelectorAll("script");
    for (const s of scripts) {
      const text = s.textContent || "";
      // Match page data from content XML or JS variables
      const pageMatches = text.matchAll(
        /page_no["']?\s*[:=]\s*["']?(\d+)["']?/g,
      );
      for (const m of pageMatches) {
        const idx = parseInt(m[1], 10) - 1;
        if (!results.find((r) => r.idx === idx)) {
          // Try to find corresponding video time
          const vtMatch = text.match(
            new RegExp(`videotm["']?\\s*[:=]\\s*["']?(\\d+)["']?`),
          );
          results.push({
            idx,
            lessonCntsId: "",
            videoTm: vtMatch ? parseInt(vtMatch[1], 10) : 600,
            title: `Page ${idx + 1}`,
          });
        }
      }
    }

    // If no structured data found, check for plyr video elements
    if (results.length === 0) {
      const videos = document.querySelectorAll("video, .plyr");
      if (videos.length > 0) {
        results.push({
          idx: 0,
          lessonCntsId: "",
          videoTm: 600, // default 10 min
          title: "Page 1",
        });
      }
    }

    // Fallback: single page
    if (results.length === 0) {
      results.push({ idx: 0, lessonCntsId: "", videoTm: 600, title: "Page 1" });
    }

    return results.sort((a, b) => a.idx - b.idx);
  });
}

/**
 * Navigate to a specific content page within the lesson viewer.
 */
async function navigateToPage(page: Page, pageIdx: number): Promise<void> {
  await page.evaluate((idx) => {
    // Common LMS page navigation patterns
    const w = window as unknown as Record<string, unknown>;
    const fn = w.goPage || w.movePage || w.fnMovePage;
    if (typeof fn === "function") {
      fn(idx);
    } else {
      // Try clicking page navigation buttons
      const btns = document.querySelectorAll(
        ".page-nav button, .page-list li, .paging a",
      );
      if (btns[idx]) {
        (btns[idx] as HTMLElement).click();
      }
    }
  }, pageIdx);

  // Wait for page content to load
  await page.waitForTimeout(2000);
}

/**
 * Start video playback at 2× speed using the plyr player.
 */
async function startPlayback(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Find the plyr player instance
    const video = document.querySelector("video") as HTMLVideoElement | null;
    if (video) {
      video.playbackRate = 2.0;
      video.muted = true; // avoid audio issues in headless
      video.play().catch(() => {});
    }

    // Also try plyr API if available
    const plyrEl = document.querySelector(".plyr") as unknown as {
      plyr?: { speed: number; play: () => void; muted: boolean };
    } | null;
    if (plyrEl?.plyr) {
      plyrEl.plyr.speed = 2;
      plyrEl.plyr.muted = true;
      plyrEl.plyr.play();
    }
  });

  console.log("[attend] playback started at 2× speed");
}

/**
 * Wait for a content page to complete playback.
 * At 2× speed, a video of N seconds takes N/2 seconds real time.
 * We add buffer for network/save delays.
 */
async function waitForPageCompletion(
  page: Page,
  pg: PageInfo,
  isComplete: () => boolean,
): Promise<void> {
  const realSeconds = Math.ceil(pg.videoTm / 2) + 30; // 2× speed + 30s buffer
  const checkInterval = 10_000; // check every 10s
  const maxWait = realSeconds * 1000;
  let elapsed = 0;

  console.log(`[attend] waiting ~${realSeconds}s for page completion...`);

  while (elapsed < maxWait && !isComplete()) {
    await page.waitForTimeout(checkInterval);
    elapsed += checkInterval;

    // Check if video is still playing
    const videoState = await page.evaluate(() => {
      const v = document.querySelector("video") as HTMLVideoElement | null;
      if (!v) return { playing: false, currentTime: 0, duration: 0 };
      return {
        playing: !v.paused && !v.ended,
        currentTime: v.currentTime,
        duration: v.duration,
      };
    });

    if (videoState.duration > 0) {
      const pct = Math.round(
        (videoState.currentTime / videoState.duration) * 100,
      );
      console.log(
        `[attend] progress: ${pct}% (${Math.round(videoState.currentTime)}/${Math.round(videoState.duration)}s)`,
      );

      if (!videoState.playing && videoState.currentTime >= videoState.duration - 1) {
        console.log("[attend] video finished");
        break;
      }
    }

    // Re-ensure playback is running (auto-pause protection)
    await page.evaluate(() => {
      const v = document.querySelector("video") as HTMLVideoElement | null;
      if (v && v.paused && !v.ended) {
        v.playbackRate = 2.0;
        v.play().catch(() => {});
      }
    });
  }

  // Brief wait after completion for final save to process
  await page.waitForTimeout(5000);
}
