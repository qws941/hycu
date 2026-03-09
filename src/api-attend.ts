/**
 * api-attend.ts
 *
 * API-based attendance — uses direct HTTP calls to LMS API (saveStdyRecord.do)
 * instead of Playwright video playback. Same dual-call pattern as Workers.
 * Completes in seconds instead of ~330s per course.
 *
 * Usage: npx tsx src/index.ts api-attend
 */

import { config } from './config.js';
import {
  loadCookieHeaders,
  fetchToken,
  assertNotSessionRedirect,
  parseJsonResponse,
} from './cookies.js';
import { ApiError, SessionExpiredError } from './errors.js';

const LMS = config.urls.lms;
const USER_NO = config.userId;
const YEAR = config.semester.year;
const SEMESTER = config.semester.term;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CourseInfo {
  crsCreCd: string;
  name: string;
  progressRatio: number;
}

interface LessonSchedule {
  lessonScheduleId: string;
  lessonTimeId: string;
  lessonCntsId: string;
  title: string;
  pageCount: number;
  attended: boolean;
  progressRatio: number;
  lbnTm: number;
  lessonStartDt: string;
  lessonEndDt: string;
  ltDetmToDtMax: string;
}

// ---------------------------------------------------------------------------
// API functions (pure fetch — same logic as web/src/lib/)
// ---------------------------------------------------------------------------

async function fetchCourses(token: string): Promise<CourseInfo[]> {
  const qs = new URLSearchParams({
    year: YEAR,
    semester: SEMESTER,
    userNo: USER_NO,
    progressType: 'C',
    token,
  });
  const res = await fetch(`${LMS}/api/selectStdProgressRatio.do?${qs}`, {
    headers: { 'x-requested-with': 'XMLHttpRequest' },
  });
  const data = await parseJsonResponse<Record<string, unknown>>(res, 'fetchCourses');
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
        progressRatio: Number(item.progRatio || 0),
      };
    })
    .filter((c) => c.crsCreCd);
}

async function fetchLessonSchedules(
  lmsCookies: string,
  crsCreCd: string,
): Promise<LessonSchedule[]> {
  const stdNo = `${crsCreCd}${USER_NO}`;
  const res = await fetch(`${LMS}/crs/listCrsHomeLessonSchedule.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: lmsCookies,
    },
    body: new URLSearchParams({ crsCreCd, stdNo, userNo: USER_NO }).toString(),
  });
  const data = await parseJsonResponse<Record<string, unknown>>(res, 'fetchLessonSchedules');
  const list = (data.returnList ?? data.list ?? (Array.isArray(data) ? data : [])) as Array<
    Record<string, unknown>
  >;
  return list.map((item) => {
    const times = (item.listLessonTime ?? []) as Array<Record<string, unknown>>;
    const time0 = times[0] ?? {};
    const cntsList = (time0.listLessonCnts ?? []) as Array<Record<string, unknown>>;
    const cnts0 = cntsList[0] ?? {};
    return {
      lessonScheduleId: String(item.lessonScheduleId ?? ''),
      lessonTimeId: String(time0.lessonTimeId ?? item.lessonTimeId ?? ''),
      lessonCntsId: String(cnts0.lessonCntsId ?? item.lessonCntsId ?? ''),
      title: String(item.lessonScheduleNm ?? item.title ?? ''),
      pageCount: Number(cnts0.cntsPageCnt ?? item.pageCnt ?? 1),
      attended: item.atndYn === 'Y',
      progressRatio: Number(item.prgrRatio ?? 0),
      lbnTm: Number(item.lbnTm ?? 30),
      lessonStartDt: String(item.lessonStartDt ?? ''),
      lessonEndDt: String(item.lessonEndDt ?? ''),
      ltDetmToDtMax: String(item.ltDetmToDtMax ?? ''),
    };
  });
}

// Debug: log extracted IDs
function debugLesson(l: LessonSchedule) {
  console.log(`    [IDs] scheduleId=${l.lessonScheduleId} timeId=${l.lessonTimeId} cntsId=${l.lessonCntsId} lbnTm=${l.lbnTm} pages=${l.pageCount}`);
}

// ---------------------------------------------------------------------------
// Attendance recording — HAR-verified dual-call pattern
// ---------------------------------------------------------------------------

function nowHHMMSS(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}${m}${s}`;
}

async function postStudyRecord(
  lmsCookies: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; result: number; raw: string }> {
  const crsCreCd = params.get('crsCreCd') || '';
  const lessonScheduleId = params.get('lessonScheduleId') || '';
  const lessonTimeId = params.get('lessonTimeId') || '';
  const res = await fetch(`${LMS}/lesson/stdy/saveStdyRecord.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': LMS,
      'Referer': `${LMS}/crs/crsStdLessonView.do?crsCreCd=${crsCreCd}&lessonScheduleId=${lessonScheduleId}&lessonTimeId=${lessonTimeId}`,
      Cookie: lmsCookies,
    },
    body: params.toString(),
    redirect: 'follow',
  });

  assertNotSessionRedirect(res);

  const text = await res.text();

  // Detect HTML response (session expired with 200 OK)
  if (text.trimStart().startsWith('<')) {
    throw new SessionExpiredError('saveStdyRecord: API가 HTML 반환 (세션 만료)');
  }

  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return { ok: res.ok, result: Number(json.result ?? 0), raw: text };
  } catch {
    throw new ApiError(`saveStdyRecord: JSON 파싱 실패 — ${text.slice(0, 200)}`);
  }
}

async function saveAttendanceRecord(
  lmsCookies: string,
  crsCreCd: string,
  lesson: LessonSchedule,
): Promise<{ success: boolean; message: string }> {
  const stdNo = `${crsCreCd}${USER_NO}`;
  const lbnTm = lesson.lbnTm || 30;
  const requiredMinutes = Math.ceil(lbnTm * 0.55);
  const playStartDttm = nowHHMMSS();

  // Step 0: Open lesson viewer page — initializes server-side study session (HAR-verified)
  const viewUrl = `${LMS}/crs/crsStdLessonView.do?crsCreCd=${crsCreCd}&lessonScheduleId=${lesson.lessonScheduleId}&lessonTimeId=${lesson.lessonTimeId}&lessonCntsIdx=0`;
  const viewRes = await fetch(viewUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': `${LMS}/crs/crsHomeStd.do?crsCreCd=${crsCreCd}`,
      Cookie: lmsCookies,
    },
  });
  assertNotSessionRedirect(viewRes);

  // Pre-call: checkStdySchedule.do — initializes server-side study session (HAR-verified)
  const checkRes = await fetch(`${LMS}/lesson/stdy/checkStdySchedule.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': LMS,
      'Referer': `${LMS}/crs/crsStdLessonView.do?crsCreCd=${crsCreCd}&lessonScheduleId=${lesson.lessonScheduleId}&lessonTimeId=${lesson.lessonTimeId}`,
      Cookie: lmsCookies,
    },
    body: new URLSearchParams({ crsCreCd, lessonScheduleId: lesson.lessonScheduleId, stdNo }).toString(),
  });
  assertNotSessionRedirect(checkRes);
  if (!checkRes.ok) {
    return { success: false, message: `checkStdySchedule failed (HTTP ${checkRes.status})` };
  }

  const baseParams = {
    userNo: USER_NO,
    stdNo,
    crsCreCd,
    lessonScheduleId: lesson.lessonScheduleId,
    lessonCntsId: lesson.lessonCntsId,
    lessonTimeId: lesson.lessonTimeId,
    lessonStartDt: lesson.lessonStartDt,
    lessonEndDt: lesson.lessonEndDt,
    ltDetmToDtMax: lesson.ltDetmToDtMax,
    speedPlayTime: 'false',
    lbnTm: String(lbnTm),
    studyCnt: '2',
    studyStatusCd: 'STUDY',
    prgrYn: 'Y',
    studyTotalTm: '0',
    studyAfterTm: '0',
    studySumTm: '0',
    pageCnt: String(lesson.pageCount),
    pageStudyTm: String((requiredMinutes - 1) * 60),
    pageStudyCnt: '2',
    pageAtndYn: 'Y',
    playSpeed: '1',
    playStartDttm,
  };

  // Call 1: start — initial study record (HAR-verified)
  const r1 = await postStudyRecord(
    lmsCookies,
    new URLSearchParams({
      ...baseParams,
      studySessionTm: String(requiredMinutes * 60),
      cntsPlayTm: '0',
      studySessionLoc: String(requiredMinutes * 60),
      pageSessionTm: String(requiredMinutes * 60),
      cntsRatio: '0',
      pageRatio: '8',
      saveType: 'start',
    }),
  );
  if (!r1.ok) {
    return { success: false, message: `HTTP error (call 1)` };
  }

  // 2s delay between calls (matches HAR timing)
  await new Promise((r) => setTimeout(r, 2000));

  // Pre-call 2: checkStdySchedule again before second save (HAR-verified)
  const check2Res = await fetch(`${LMS}/lesson/stdy/checkStdySchedule.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'X-Requested-With': 'XMLHttpRequest',
      'Origin': LMS,
      'Referer': `${LMS}/crs/crsStdLessonView.do?crsCreCd=${crsCreCd}&lessonScheduleId=${lesson.lessonScheduleId}&lessonTimeId=${lesson.lessonTimeId}`,
      Cookie: lmsCookies,
    },
    body: new URLSearchParams({ crsCreCd, lessonScheduleId: lesson.lessonScheduleId, stdNo }).toString(),
    redirect: 'follow',
  });
  assertNotSessionRedirect(check2Res);

  // Call 2: second record — same saveType, updated timing (HAR-verified)
  const playStartDttm2 = nowHHMMSS();
  const r2 = await postStudyRecord(
    lmsCookies,
    new URLSearchParams({
      ...baseParams,
      playStartDttm: playStartDttm2,
      studySessionTm: String(requiredMinutes * 60),
      cntsPlayTm: String((requiredMinutes - 1) * 60),
      studySessionLoc: String(requiredMinutes * 60),
      pageSessionTm: String(requiredMinutes * 60),
      cntsRatio: '0',
      pageRatio: '55',
      saveType: 'start',
    }),
  );

  // result >= 1 means record saved (HAR-verified: result=1 on success)
  if (r2.result >= 1) {
    return { success: true, message: `완료 (result=${r2.result})` };
  }
  if (r2.ok) {
    return { success: true, message: `전송됨 (result=${r2.result})` };
  }
  return { success: false, message: `실패 (result=${r2.result})` };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function apiAttend(): Promise<void> {
  // 1. Load cookies from Playwright session (throws CookieError/SessionExpiredError)
  const { roadCookies, lmsCookies } = await loadCookieHeaders();
  console.log('[api-attend] 쿠키 로드 완료');

  // 2. Get auth token + course list (throws SessionExpiredError on expiry)
  const token = await fetchToken(roadCookies);
  console.log(`[api-attend] 토큰 획득: ${token.substring(0, 20)}...`);

  const courses = await fetchCourses(token);
  console.log(`[api-attend] ${courses.length}개 과목 발견`);

  // 3. KST date for filtering
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const today = kstNow.toISOString().slice(0, 10).replace(/-/g, '');

  let totalProcessed = 0;
  let totalSuccess = 0;

  for (const course of courses) {
    console.log(`\n[api-attend] === ${course.name} (${course.crsCreCd}) ===`);

    const lessons = await fetchLessonSchedules(lmsCookies, course.crsCreCd);

    // Filter: started + not expired + not attended
    const pending = lessons.filter((l) => {
      if (l.attended) return false;
      const start = l.lessonStartDt?.replace(/-/g, '') ?? '';
      const deadline = l.ltDetmToDtMax?.replace(/-/g, '') ?? '';
      if (start && start > today) return false; // not yet open
      if (deadline && deadline < today) return false; // past deadline
      return true;
    });

    console.log(`[api-attend] 전체 ${lessons.length}개 → 대상 ${pending.length}개`);

    for (const lesson of pending) {
      debugLesson(lesson);
      console.log(`[api-attend]   ${lesson.title} (lbnTm=${lesson.lbnTm}min)...`);
      const result = await saveAttendanceRecord(lmsCookies, course.crsCreCd, lesson);
      console.log(`[api-attend]   → ${result.message}`);
      totalProcessed++;
      if (result.success) totalSuccess++;

      // 500ms delay between lessons (rate-limit guard)
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n[api-attend] 완료: ${totalSuccess}/${totalProcessed} 성공`);
}
