import { config } from './config.js';
import { loadCookieHeaders, fetchToken } from './cookies.js';
import {
  fetchCourses,
  fetchLessonSchedules,
  type CourseProgress,
  type LessonSchedule,
  type LessonState,
} from './lms-api.js';
import { getTodayKst, classifyLesson } from './date.js';

const USER_NO = config.userId;

function formatDeadline(date: string): string {
  if (date.length < 8) {
    return '--/--';
  }
  return `${date.slice(4, 6)}/${date.slice(6, 8)}`;
}

function renderLessonLine(index: number, lesson: LessonSchedule, state: LessonState): string {
  if (state === 'attended') {
    return `  ${index}주차: ✅ 출석완료`;
  }
  if (state === 'pending') {
    const deadline = formatDeadline(lesson.ltDetmToDtMax || lesson.lessonEndDt);
    return `  ${index}주차: ⏳ 출석대기 (~${deadline} 마감)`;
  }
  if (state === 'overdue') {
    return `  ${index}주차: ❌ 기한초과`;
  }
  return `  ${index}주차: 🔒 미개강`;
}

export async function status(): Promise<CourseProgress[]> {
  console.log('[status] HYCU LMS Status');
  console.log(`  User: ${USER_NO} (${config.userName})\n`);

  const { roadCookies, lmsCookies } = await loadCookieHeaders();

  const token = await fetchToken(roadCookies);
  console.log(`[status] LMS token acquired (${token.length} chars)`);

  const courses = await fetchCourses(token);
  if (courses.length === 0) {
    console.log('[status] no courses found for current semester');
    return [];
  }

  const today = getTodayKst();
  const progress: CourseProgress[] = [];
  const detailRows: Array<{
    name: string;
    pending: number;
    overdue: number;
    lessons: Array<{ lesson: LessonSchedule; state: LessonState }>;
  }> = [];

  for (const course of courses) {
    const lessons = await fetchLessonSchedules(lmsCookies, course.crsCreCd);
    const classified = lessons.map((lesson) => ({
      lesson,
      state: classifyLesson(lesson, today),
    }));

    let attended = 0;
    let pending = 0;
    let overdue = 0;

    for (const row of classified) {
      if (row.state === 'attended') attended += 1;
      if (row.state === 'pending') pending += 1;
      if (row.state === 'overdue') overdue += 1;
    }

    progress.push({
      name: course.name,
      crsCreCd: course.crsCreCd,
      progressRatio: course.progressRatio,
      attendCount: attended,
      totalCount: lessons.length,
    });

    detailRows.push({
      name: course.name,
      pending,
      overdue,
      lessons: classified,
    });
  }

  console.log('\n' + '='.repeat(86));
  console.log(
    `  ${'과목명'.padEnd(34)} ${'진도율'.padStart(7)}  ${'출석'.padStart(10)}  ${'대기'.padStart(4)}  ${'초과'.padStart(4)}`,
  );
  console.log('='.repeat(86));

  for (let i = 0; i < progress.length; i += 1) {
    const p = progress[i];
    const d = detailRows[i];
    const name = p.name.length > 33 ? `${p.name.slice(0, 30)}...` : p.name;
    const ratio = `${p.progressRatio}%`.padStart(6);
    const count = `${p.attendCount}/${p.totalCount}`.padStart(10);
    const pending = String(d.pending).padStart(4);
    const overdue = String(d.overdue).padStart(4);
    console.log(`  ${name.padEnd(34)} ${ratio}  ${count}  ${pending}  ${overdue}`);
  }
  console.log('='.repeat(86));

  for (const detail of detailRows) {
    if (detail.pending === 0 && detail.overdue === 0) {
      continue;
    }

    console.log(`\n📌 ${detail.name}`);
    detail.lessons.forEach((row, idx) => {
      console.log(renderLessonLine(idx + 1, row.lesson, row.state));
    });
  }

  console.log('='.repeat(70));

  return progress;
}
