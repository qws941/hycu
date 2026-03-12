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
} from './cookies.js';
import { ApiError, SessionExpiredError } from './errors.js';
import {
  fetchCourses,
  fetchLessonSchedules,
  type LessonSchedule,
} from './lms-api.js';
import { classifyLesson, getTodayKst } from './date.js';

const LMS = config.urls.lms;
const USER_NO = config.userId;
export interface AttendanceLessonResult {
  courseName: string;
  crsCreCd: string;
  lessonTitle: string;
  success: boolean;
  message: string;
}

export interface ApiAttendSummary {
  coursesDiscovered: number;
  processed: number;
  succeeded: number;
  lessons: AttendanceLessonResult[];
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

export async function apiAttend(): Promise<ApiAttendSummary> {
  // 1. Load cookies from Playwright session (throws CookieError/SessionExpiredError)
  const { roadCookies, lmsCookies } = await loadCookieHeaders();
  console.log('[api-attend] 쿠키 로드 완료');

  // 2. Get auth token + course list (throws SessionExpiredError on expiry)
  const token = await fetchToken(roadCookies);
  console.log(`[api-attend] 토큰 획득: ${token.substring(0, 20)}...`);

  const courses = await fetchCourses(token);
  console.log(`[api-attend] ${courses.length}개 과목 발견`);

  // 3. KST date for filtering
  const today = getTodayKst();

  let totalProcessed = 0;
  let totalSuccess = 0;
  const lessonResults: AttendanceLessonResult[] = [];

  for (const course of courses) {
    console.log(`\n[api-attend] === ${course.name} (${course.crsCreCd}) ===`);

    const lessons = await fetchLessonSchedules(lmsCookies, course.crsCreCd);

    const pending = lessons.filter((l) => {
      return classifyLesson(l, today) === 'pending';
    });

    console.log(`[api-attend] 전체 ${lessons.length}개 → 대상 ${pending.length}개`);

    for (const lesson of pending) {
      debugLesson(lesson);
      console.log(`[api-attend]   ${lesson.title} (lbnTm=${lesson.lbnTm}min)...`);
      const result = await saveAttendanceRecord(lmsCookies, course.crsCreCd, lesson);
      console.log(`[api-attend]   → ${result.message}`);
      totalProcessed++;
      if (result.success) totalSuccess++;
      lessonResults.push({
        courseName: course.name,
        crsCreCd: course.crsCreCd,
        lessonTitle: lesson.title,
        success: result.success,
        message: result.message,
      });

      // 500ms delay between lessons (rate-limit guard)
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n[api-attend] 완료: ${totalSuccess}/${totalProcessed} 성공`);

  return {
    coursesDiscovered: courses.length,
    processed: totalProcessed,
    succeeded: totalSuccess,
    lessons: lessonResults,
  };
}
