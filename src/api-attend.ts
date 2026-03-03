/**
 * api-attend.ts
 *
 * API-based attendance — uses direct HTTP calls to LMS API (saveStdyRecord.do)
 * instead of Playwright video playback. Same dual-call pattern as Workers.
 * Completes in seconds instead of ~330s per course.
 *
 * Usage: npx tsx src/index.ts api-attend
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { config } from './config.js';

const LMS = config.urls.lms;
const ROAD = config.urls.road;
const USER_NO = config.userId;
const YEAR = '2026';
const SEMESTER = '10';

// ---------------------------------------------------------------------------
// Cookie handling
// ---------------------------------------------------------------------------

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
}

function cookiesToHeader(cookies: PlaywrightCookie[], domain: string): string {
  return cookies
    .filter((c) => c.domain === domain || c.domain === `.${domain}`)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

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

async function fetchToken(roadCookies: string): Promise<string> {
  const res = await fetch(`${ROAD}/pot/MainCtr/findToken.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: roadCookies,
    },
    body: 'gubun=lms',
  });
  const raw = (await res.text()).trim();
  let token = raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.token === 'string') token = parsed.token;
  } catch {
    // plain text token — use as-is
  }
  if (!token || token.length < 10) {
    throw new Error(`유효하지 않은 토큰: ${token.substring(0, 50)}`);
  }
  return token;
}

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
  const data = (await res.json()) as Record<string, unknown>;
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
  const data = (await res.json()) as Record<string, unknown>;
  const list = (data.returnList ?? data.list ?? (Array.isArray(data) ? data : [])) as Array<
    Record<string, unknown>
  >;
  return list.map((item) => ({
    lessonScheduleId: String(item.lessonScheduleId ?? ''),
    lessonTimeId: String(item.lessonTimeId ?? ''),
    lessonCntsId: String(item.lessonCntsId ?? ''),
    title: String(item.lessonScheduleNm ?? item.title ?? ''),
    pageCount: Number(item.pageCnt ?? 1),
    attended: item.atndYn === 'Y',
    progressRatio: Number(item.prgrRatio ?? 0),
    lbnTm: Number(item.lbnTm ?? 30),
    lessonStartDt: String(item.lessonStartDt ?? ''),
    lessonEndDt: String(item.lessonEndDt ?? ''),
    ltDetmToDtMax: String(item.ltDetmToDtMax ?? ''),
  }));
}

// ---------------------------------------------------------------------------
// Attendance recording — HAR-verified dual-call pattern
// ---------------------------------------------------------------------------

function nowHHMMSS(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
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
    redirect: 'manual',
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return { ok: res.ok, result: Number(json.result ?? 0), raw: text };
  } catch {
    return { ok: res.ok, result: 0, raw: text };
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
  await fetch(viewUrl, {
    method: 'GET',
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Referer': `${LMS}/crs/crsHomeStd.do?crsCreCd=${crsCreCd}`,
      Cookie: lmsCookies,
    },
    redirect: 'manual',
  });
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
    redirect: 'manual',
  });
  if (!checkRes.ok) {
    return { success: false, message: 'checkStdySchedule failed' };
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
    studyTotalTm: String(requiredMinutes),
    studyAfterTm: '0',
    studySumTm: String(requiredMinutes),
    pageCnt: String(lesson.pageCount),
    pageStudyTm: String(requiredMinutes - 1),
    pageStudyCnt: '2',
    pageAtndYn: 'Y',
    playSpeed: '1',
    playStartDttm,
  };

  try {
    // Call 1: start — initial study record (HAR-verified)
    const r1 = await postStudyRecord(
      lmsCookies,
      new URLSearchParams({
        ...baseParams,
        studySessionTm: '1',
        cntsPlayTm: '0',
        studySessionLoc: String(requiredMinutes - 1),
        pageSessionTm: '0',
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
    await fetch(`${LMS}/lesson/stdy/checkStdySchedule.do`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': LMS,
        'Referer': `${LMS}/crs/crsStdLessonView.do?crsCreCd=${crsCreCd}&lessonScheduleId=${lesson.lessonScheduleId}&lessonTimeId=${lesson.lessonTimeId}`,
        Cookie: lmsCookies,
      },
      body: new URLSearchParams({ crsCreCd, lessonScheduleId: lesson.lessonScheduleId, stdNo }).toString(),
      redirect: 'manual',
    });
    // Call 2: second record — same saveType, updated timing (HAR-verified)
    const playStartDttm2 = nowHHMMSS();
    const r2 = await postStudyRecord(
      lmsCookies,
      new URLSearchParams({
        ...baseParams,
        playStartDttm: playStartDttm2,
        studySessionTm: '2',
        cntsPlayTm: '1',
        studySessionLoc: String(requiredMinutes - 5),
        pageSessionTm: '2',
        cntsRatio: '0',
        pageRatio: '9',
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
  } catch (err) {
    return { success: false, message: `오류: ${err}` };
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function apiAttend(): Promise<void> {
  // 1. Load cookies from Playwright session
  const cookieFile = resolve('cookies', 'session.json');
  let raw: string;
  try {
    raw = await readFile(cookieFile, 'utf-8');
  } catch {
    console.error('[api-attend] 쿠키 파일 없음. npm run login 먼저 실행');
    return;
  }
  const cookies = JSON.parse(raw) as PlaywrightCookie[];
  const roadCookies = cookiesToHeader(cookies, 'road.hycu.ac.kr');
  const lmsCookies = cookiesToHeader(cookies, 'lms.hycu.ac.kr');

  if (!roadCookies || !lmsCookies) {
    console.error('[api-attend] 쿠키 없음. npm run login 먼저 실행');
    return;
  }
  console.log('[api-attend] 쿠키 로드 완료');

  // 2. Get auth token + course list
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
