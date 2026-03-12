/**
 * notices.ts
 *
 * Fetches exam schedules, course announcements, assignments, quizzes,
 * and academic calendar from LMS/Road APIs. Pure fetch-based (no Playwright).
 *
 * Endpoints:
 *   - POST road/pot/UserCtr/findAllExamList.do        — exam schedule
 *   - POST lms/api/selectStuLessonNoticeList.do        — course alerts (NOTICE|ASMT|QUIZ|QNA|FORUM)
 *   - POST api.hycu.ac.kr/uni/api/findSchaffScheList   — academic calendar
 *
 * alarmType taxonomy (discovered from countStuLessonAlarm.do):
 *   NOTICE — course announcements
 *   ASMT   — assignments/homework
 *   QUIZ   — quizzes
 *   QNA    — Q&A
 *   FORUM  — discussion board
 *   SECRET — private messages
 *   RESCH  — schedule changes
 *
 * Usage: npx tsx src/index.ts notices
 */

import { config } from './config.js';
import {
  loadCookieHeaders,
  fetchToken,
  assertNotSessionRedirect,
  parseJsonResponse,
} from './cookies.js';

const LMS = config.urls.lms;
const ROAD = config.urls.road;
const USER_NO = config.userId;
const YEAR = config.semester.year;
const SEMESTER = config.semester.term;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** LMS alarm types supported by selectStuLessonNoticeList.do */
type AlarmType = 'NOTICE' | 'ASMT' | 'QUIZ' | 'QNA' | 'FORUM' | 'RESCH';

/** Generic item returned by selectStuLessonNoticeList.do for any alarmType */
export interface LmsAlarmItem {
  atclTitle: string;
  regNm: string;
  regDttm: string;
  viewLink?: string;
  crsCreCd?: string;
  crsNm?: string;
  lessonNo?: string;
  atclNo?: string;
  /** Assignment-specific: submission period */
  submitStartDttm?: string;
  submitEndDttm?: string;
  /** Quiz-specific */
  quizStartDttm?: string;
  quizEndDttm?: string;
  [key: string]: unknown;
}

export interface ExamItem {
  examNm?: string;
  examDt?: string;
  examTm?: string;
  examGbn?: string;
  crsNm?: string;
  crsCreCd?: string;
  examStartTm?: string;
  examEndTm?: string;
  examRoom?: string;
  examPlace?: string;
  examPlanCnt?: number;
  examType?: string;
  [key: string]: unknown;
}

export interface AcademicScheduleItem {
  scheTerm: string;
  schaffScheNm: string;
  linkUrl?: string;
}

export interface NoticesData {
  exams: ExamItem[];
  notices: LmsAlarmItem[];
  assignments: LmsAlarmItem[];
  quizzes: LmsAlarmItem[];
  schedule: AcademicScheduleItem[];
}

// ---------------------------------------------------------------------------
// API: LMS alarm list (generic for any alarmType)
// ---------------------------------------------------------------------------

async function fetchLmsAlarmList(
  roadCookies: string,
  token: string,
  alarmType: AlarmType,
): Promise<LmsAlarmItem[]> {
  const res = await fetch(`${LMS}/api/selectStuLessonNoticeList.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: roadCookies,
      Referer: `${ROAD}/`,
    },
    body: new URLSearchParams({
      year: YEAR,
      semester: SEMESTER,
      userNo: USER_NO,
      alarmType,
      token,
    }).toString(),
  });
  assertNotSessionRedirect(res);
  const data = await parseJsonResponse<{
    result?: number;
    returnList?: LmsAlarmItem[];
  }>(res, `fetchLmsAlarmList(${alarmType})`);
  return data.returnList ?? [];
}

// ---------------------------------------------------------------------------
// API: Exam list
// ---------------------------------------------------------------------------

async function fetchExamList(roadCookies: string): Promise<ExamItem[]> {
  const res = await fetch(`${ROAD}/pot/UserCtr/findAllExamList.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: roadCookies,
    },
    body: `yy=${YEAR}&tmGbn=${SEMESTER}`,
  });
  assertNotSessionRedirect(res);
  const data = await parseJsonResponse<{ allExamList?: ExamItem[] }>(res, 'fetchExamList');
  return data.allExamList ?? [];
}

// ---------------------------------------------------------------------------
// API: Academic calendar
// ---------------------------------------------------------------------------

async function fetchAcademicSchedule(): Promise<AcademicScheduleItem[]> {
  try {
    const res = await fetch('https://api.hycu.ac.kr/uni/api/findSchaffScheList', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_NO, univGbn: '1' }),
    });
    const text = await res.text();
    if (!text) return [];
    const data = JSON.parse(text) as {
      result?: AcademicScheduleItem[];
      code?: string;
    };
    return data.result ?? [];
  } catch (err) {
    console.warn('[notices] \ud559\uc0ac \uc77c\uc815 \uc870\ud68c \uc2e4\ud328:', (err as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

function printSection(title: string) {
  console.log(`
${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

/** Group items by course name, falling back to '\uae30\ud0c0' for unknown courses. */
function groupByCourse<T extends { crsNm?: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const course = item.crsNm ?? '\uae30\ud0c0';
    const list = groups.get(course);
    if (list) {
      list.push(item);
    } else {
      groups.set(course, [item]);
    }
  }
  return groups;
}

/** Classify exam by name pattern: \uc911\uac04 \u2192 midterm, \uae30\ub9d0 \u2192 final */
function examLabel(exam: ExamItem): string {
  const name = (exam.examNm ?? exam.examGbn ?? '').toLowerCase();
  if (name.includes('\uc911\uac04')) return '\uc911\uac04\uace0\uc0ac';
  if (name.includes('\uae30\ub9d0')) return '\uae30\ub9d0\uace0\uc0ac';
  if (name.includes('quiz') || name.includes('\ud034\uc988')) return '\ud034\uc988';
  return exam.examNm ?? '\uc2dc\ud5d8';
}

function formatDate(dttm?: string): string {
  if (!dttm) return '';
  // Handle "2026-03-12 14:00:00" or "20260312140000" formats
  if (dttm.length >= 10) return dttm.slice(0, 10);
  return dttm;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

export async function getNoticesData(): Promise<NoticesData> {
  console.log('[notices] Loading cookies...');
  const { roadCookies } = await loadCookieHeaders();

  console.log('[notices] Fetching token...');
  const token = await fetchToken(roadCookies);

  console.log('[notices] Fetching data (exams, notices, assignments, quizzes, calendar)...');
  const [exams, noticeItems, assignments, quizzes, schedule] = await Promise.all([
    fetchExamList(roadCookies),
    fetchLmsAlarmList(roadCookies, token, 'NOTICE'),
    fetchLmsAlarmList(roadCookies, token, 'ASMT'),
    fetchLmsAlarmList(roadCookies, token, 'QUIZ'),
    fetchAcademicSchedule(),
  ]);

  return { exams, notices: noticeItems, assignments, quizzes, schedule };
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function printExams(exams: ExamItem[]) {
  printSection('\uc2dc\ud5d8 \uc77c\uc815 (Exam Schedule)');
  if (exams.length === 0) {
    console.log('  \ud604\uc7ac \ub4f1\ub85d\ub41c \uc2dc\ud5d8\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.');
    return;
  }

  const grouped = groupByCourse(exams);
  for (const [course, items] of grouped) {
    console.log(`
  📚 ${course}`);
    for (const exam of items) {
      const label = examLabel(exam);
      console.log(`     \ud83d\udcdd ${label}`);
      if (exam.examDt) console.log(`        \ub0a0\uc9dc: ${exam.examDt}`);
      if (exam.examTm) console.log(`        \uc2dc\uac04: ${exam.examTm}`);
      if (exam.examStartTm && exam.examEndTm) {
        console.log(`        \uc2dc\uac04: ${exam.examStartTm} ~ ${exam.examEndTm}`);
      }
      if (exam.examRoom || exam.examPlace) {
        console.log(`        \uc7a5\uc18c: ${exam.examRoom ?? exam.examPlace}`);
      }
    }
  }
}

function printAlarmItems(title: string, emoji: string, items: LmsAlarmItem[], maxItems = 30) {
  printSection(`${title} \u2014 ${items.length}\uac74`);
  if (items.length === 0) {
    console.log('  \ub4f1\ub85d\ub41c \ud56d\ubaa9\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.');
    return;
  }

  const grouped = groupByCourse(items);
  let shown = 0;

  for (const [course, courseItems] of grouped) {
    if (shown >= maxItems) break;
    console.log(`
  📚 ${course}`);
    for (const item of courseItems) {
      if (shown >= maxItems) break;
      const date = formatDate(item.regDttm);
      console.log(`     ${emoji} [${date}] ${item.atclTitle}`);
      console.log(`        \uc791\uc131\uc790: ${item.regNm}`);

      // Assignment deadline info
      if (item.submitEndDttm) {
        console.log(`        \uc81c\ucd9c\ub9c8\uac10: ${formatDate(item.submitEndDttm)}`);
      }
      // Quiz period info
      if (item.quizEndDttm) {
        console.log(`        \uc751\uc2dc\ub9c8\uac10: ${formatDate(item.quizEndDttm)}`);
      }
      shown++;
    }
  }

  if (items.length > maxItems) {
    console.log(`
  ... 외 ${items.length - maxItems}건`);
  }
}

function printAcademicSchedule(schedule: AcademicScheduleItem[]) {
  printSection('\ud559\uc0ac \uc77c\uc815 (Academic Calendar)');
  if (schedule.length === 0) {
    console.log('  \ud559\uc0ac \uc77c\uc815\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.');
    return;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  for (const item of schedule) {
    const monthStr = item.scheTerm?.slice(0, 2) ?? '';
    const month = parseInt(monthStr, 10);
    const marker = month >= currentMonth ? '\u2192' : ' ';
    console.log(`  ${marker} [${item.scheTerm}] ${item.schaffScheNm}`);
  }
}

export async function notices(): Promise<NoticesData> {
  const data = await getNoticesData();

  printExams(data.exams);
  printAlarmItems('\uacfc\uc81c (Assignments)', '\ud83d\udccb', data.assignments);
  printAlarmItems('\ud034\uc988 (Quizzes)', '\u2753', data.quizzes);
  printAlarmItems('\uacf5\uc9c0\uc0ac\ud56d (Course Notices)', '\ud83d\udce2', data.notices);
  printAcademicSchedule(data.schedule);

  console.log(`
${'─'.repeat(60)}`);
  console.log(
    `  \ud569\uacc4: \uc2dc\ud5d8 ${data.exams.length} | \uacfc\uc81c ${data.assignments.length} | ` +
    `\ud034\uc988 ${data.quizzes.length} | \uacf5\uc9c0 ${data.notices.length} | \ud559\uc0ac\uc77c\uc815 ${data.schedule.length}`,
  );
  console.log();

  return data;
}
