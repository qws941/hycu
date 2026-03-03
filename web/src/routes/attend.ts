import { Hono } from 'hono';
import type { AppEnv, AttendResult, RunEvent, DashboardState } from '../types';
import { getSession } from '../lib/session';
import { fetchToken, fetchCoursesWithProgress } from '../lib/lms';
import { fetchLessonSchedules, saveAttendanceRecord } from '../lib/attendance';
import { KV_KEYS } from '../lib/constants';

const app = new Hono<AppEnv>();

app.post('/', async (c) => {
  const kv = c.env.HYCU_KV;
  const userNo = c.env.HYCU_USER_ID;

  if (!userNo) {
    return c.json({ error: 'HYCU_USER_ID가 설정되지 않았습니다.' }, 500);
  }

  const session = await getSession(kv);
  if (!session) {
    return c.json(
      { error: '세션 없음. 먼저 쿠키를 등록하세요.' },
      401,
    );
  }

  const results: AttendResult[] = [];
  const logs: string[] = [];

  try {
    // 1. Token
    logs.push('토큰 요청 중...');
    const token = await fetchToken(session.roadCookies);
    logs.push(`토큰 획득: ${token.substring(0, 8)}...`);

    // 2. Course list
    logs.push('과목 목록 조회 중...');
    const courses = await fetchCoursesWithProgress(token, userNo);

    if (courses.length === 0) {
      return c.json({
        success: true,
        results,
        logs,
        message: '등록된 과목이 없습니다.',
      });
    }

    // 3. Process each course
    for (const course of courses) {
      logs.push(`\n[${course.name}] 차시 조회 중...`);

      try {
        const lessons = await fetchLessonSchedules(
          session.lmsCookies,
          course.crsCreCd,
          userNo,
        );
        const unattended = lessons.filter(
          (l) => !l.attended || l.progressRatio < 100,
        );

        if (unattended.length === 0) {
          logs.push('  ✓ 모든 차시 출석 완료');
          continue;
        }

        logs.push(`  미출석 ${unattended.length}/${lessons.length} 차시`);

        for (const lesson of unattended) {
          logs.push(`  출석 처리 중: ${lesson.title}`);
          const result = await saveAttendanceRecord(
            session.lmsCookies,
            userNo,
            course.crsCreCd,
            lesson,
          );

          results.push({
            crsCreCd: course.crsCreCd,
            courseName: course.name,
            lessonTitle: lesson.title,
            success: result.success,
            message: result.message,
          });

          logs.push(`  ${result.success ? '✓' : '✗'} ${result.message}`);

          // Rate-limit guard
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        logs.push(`  ✗ 차시 조회 실패: ${err}`);
        results.push({
          crsCreCd: course.crsCreCd,
          courseName: course.name,
          lessonTitle: '',
          success: false,
          message: `차시 조회 실패: ${err}`,
        });
      }
    }

    // 4. Persist event
    const successCount = results.filter((r) => r.success).length;
    const totalAttempted = results.length;

    const [eventsRaw, stateRaw] = await Promise.all([
      kv.get(KV_KEYS.events),
      kv.get(KV_KEYS.state),
    ]);
    const events: RunEvent[] = eventsRaw ? JSON.parse(eventsRaw) : [];
    events.unshift({
      timestamp: new Date().toISOString(),
      action: 'attend',
      message: `출석 처리: ${successCount}/${totalAttempted} 성공`,
      success: successCount > 0,
    });
    if (events.length > 50) events.length = 50;

    const kvWrites: Promise<void>[] = [
      kv.put(KV_KEYS.events, JSON.stringify(events)),
    ];

    if (stateRaw) {
      const state = JSON.parse(stateRaw) as DashboardState;
      state.lastAttend = new Date().toISOString();
      kvWrites.push(kv.put(KV_KEYS.state, JSON.stringify(state)));
    }

    c.executionCtx.waitUntil(Promise.all(kvWrites));

    return c.json({
      success: successCount > 0,
      results,
      logs,
      summary: {
        total: totalAttempted,
        success: successCount,
        failed: totalAttempted - successCount,
      },
    });
  } catch (err) {
    return c.json(
      { error: `출석 처리 실패: ${err}`, results, logs },
      500,
    );
  }
});

export default app;
