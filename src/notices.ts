/**
 * notices.ts
 *
 * Fetches exam schedules, course announcements, and academic calendar
 * from LMS/Road APIs. Pure fetch-based (no Playwright).
 *
 * Endpoints:
 *   - POST road/pot/UserCtr/findAllExamList.do        — exam schedule
 *   - POST lms/api/selectStuLessonNoticeList.do        — course notices
 *   - POST api.hycu.ac.kr/uni/api/findSchaffScheList   — academic calendar
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
const YEAR = '2026';
const SEMESTER = '10';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExamItem {
  examNm?: string;
  examDt?: string;
  examTm?: string;
  crsNm?: string;
  crsCreCd?: string;
  [key: string]: unknown;
}

interface NoticeItem {
  atclTitle: string;
  regNm: string;
  regDttm: string;
  viewLink?: string;
  crsCreCd?: string;
}

interface AcademicScheduleItem {
  scheTerm: string;
  schaffScheNm: string;
  linkUrl?: string;
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
// API: Course notices
// ---------------------------------------------------------------------------

async function fetchNotices(
  roadCookies: string,
  token: string,
): Promise<NoticeItem[]> {
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
      alarmType: 'NOTICE',
      token,
    }).toString(),
  });
  assertNotSessionRedirect(res);
  const data = await parseJsonResponse<{
    result?: number;
    returnList?: NoticeItem[];
  }>(res, 'fetchNotices');
  return data.returnList ?? [];
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
    console.warn('[notices] 학사 일정 조회 실패:', (err as Error).message);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

function printSection(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

export async function notices(): Promise<void> {
  console.log('[notices] Loading cookies...');

  // Use shared cookie loading (throws CookieError/SessionExpiredError on failure)
  const { roadCookies } = await loadCookieHeaders();

  console.log('[notices] Fetching token...');
  const token = await fetchToken(roadCookies);

  // Fetch all three in parallel
  const [exams, noticeList, schedule] = await Promise.all([
    fetchExamList(roadCookies),
    fetchNotices(roadCookies, token),
    fetchAcademicSchedule(),
  ]);

  // --- Exam Schedule ---
  printSection('시험 일정 (Exam Schedule)');
  if (exams.length === 0) {
    console.log('  현재 등록된 시험이 없습니다.');
  } else {
    for (const exam of exams) {
      console.log(`  📝 ${exam.examNm ?? exam.crsNm ?? 'Unknown'}`);
      if (exam.examDt) console.log(`     날짜: ${exam.examDt}`);
      if (exam.examTm) console.log(`     시간: ${exam.examTm}`);
      console.log();
    }
  }

  // --- Course Notices ---
  printSection(`공지사항 (Course Notices) — ${noticeList.length}건`);
  if (noticeList.length === 0) {
    console.log('  공지사항이 없습니다.');
  } else {
    // Group by course if possible
    const recent = noticeList.slice(0, 20); // Show max 20
    for (const notice of recent) {
      const date = notice.regDttm?.slice(0, 10) ?? '';
      console.log(`  📢 [${date}] ${notice.atclTitle}`);
      console.log(`     작성자: ${notice.regNm}`);
    }
    if (noticeList.length > 20) {
      console.log(`  ... 외 ${noticeList.length - 20}건`);
    }
  }

  // --- Academic Calendar ---
  printSection('학사 일정 (Academic Calendar)');
  if (schedule.length === 0) {
    console.log('  학사 일정이 없습니다.');
  } else {
    // Highlight upcoming events (current month and forward)
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    for (const item of schedule) {
      // scheTerm format: "03.03 ~ 03.03"
      const monthStr = item.scheTerm?.slice(0, 2) ?? '';
      const month = parseInt(monthStr, 10);
      const marker = month >= currentMonth ? '→' : ' ';
      console.log(`  ${marker} [${item.scheTerm}] ${item.schaffScheNm}`);
    }
  }

  console.log();
}
