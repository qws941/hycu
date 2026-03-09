/**
 * status.ts
 *
 * Show current lecture/attendance status.
 * Pure fetch-based — no Playwright dependency.
 *
 * 1. Load cookies from session file
 * 2. Fetch LMS token via road.hycu.ac.kr/pot/MainCtr/findToken.do
 * 3. Call selectStdProgressRatio.do to get courses + progress
 * 4. Display formatted status table
 *
 * Usage: npx tsx src/index.ts status
 */

import { config } from './config.js';
import {
  loadCookieHeaders,
  fetchToken,
  parseJsonResponse,
} from './cookies.js';

const LMS = config.urls.lms;
const USER_NO = config.userId;
const YEAR = config.semester.year;
const SEMESTER = config.semester.term;

export interface CourseProgress {
  name: string;
  crsCreCd: string;
  progressRatio: number;
  attendCount: number;
  totalCount: number;
}

/**
 * Fetch enrolled courses with progress from LMS API.
 * selectStdProgressRatio.do returns both course list and progress in one call.
 * HAR-verified params: year, semester, userNo, progressType=C, token
 */
async function fetchCoursesWithProgress(
  token: string,
): Promise<CourseProgress[]> {
  const qs = new URLSearchParams({
    year: YEAR,
    semester: SEMESTER,
    userNo: USER_NO,
    progressType: 'C',
    token,
  });
  const res = await fetch(`${LMS}/api/selectStdProgressRatio.do?${qs}`, {
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      'content-type': 'application/x-www-form-urlencoded',
    },
  });
  const data = await parseJsonResponse<Record<string, unknown>>(res, 'fetchCoursesWithProgress');
  const returnList = Array.isArray(data.returnList)
    ? (data.returnList as Array<Record<string, unknown>>)
    : [];

  return returnList
    .map((item) => {
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
}

/**
 * Show current lecture/attendance status.
 * Throws CookieError if session file missing/malformed.
 * Throws SessionExpiredError if cookies expired or token fetch fails.
 */
export async function status(): Promise<CourseProgress[]> {
  console.log('[status] HYCU LMS Status');
  console.log(`  User: ${USER_NO} (${config.userName})\n`);

  // Load cookies (throws CookieError/SessionExpiredError)
  const { roadCookies } = await loadCookieHeaders();

  // Get LMS token (throws SessionExpiredError on redirect)
  const token = await fetchToken(roadCookies);
  console.log(`[status] LMS token acquired (${token.length} chars)`);

  // Fetch courses + progress
  const progress = await fetchCoursesWithProgress(token);
  if (progress.length === 0) {
    console.log('[status] no courses found for current semester');
    return [];
  }

  // Display results
  console.log('\n' + '='.repeat(70));
  console.log(
    `  ${''.padEnd(35)} ${''.padStart(8, ' ')}Progress  Attended`,
  );
  console.log('='.repeat(70));

  for (const p of progress) {
    const name = p.name.length > 35 ? p.name.substring(0, 32) + '...' : p.name;
    const ratio = `${p.progressRatio}%`.padStart(5);
    const count = `${p.attendCount}/${p.totalCount}`;
    console.log(`  ${name.padEnd(35)} ${ratio}     ${count}`);
  }
  console.log('='.repeat(70));

  return progress;
}
