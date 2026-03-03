import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { AppEnv, Env, AttendResult, RunEvent, DashboardState } from './types';
import { authMiddleware } from './middleware/auth';
import health from './routes/health';
import session from './routes/session';
import status from './routes/status';
import attend from './routes/attend';
import sync from './routes/sync';
import { getSession } from './lib/session';
import { fetchToken, fetchCoursesWithProgress } from './lib/lms';
import { fetchLessonSchedules, saveAttendanceRecord } from './lib/attendance';
import { KV_KEYS } from './lib/constants';

const app = new Hono<AppEnv>();

app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

app.use('/api/*', authMiddleware);

app.route('/api/health', health);
app.route('/api/session', session);
app.route('/api/status', status);
app.route('/api/attend', attend);
app.route('/api/sync', sync);

export default {
  fetch: app.fetch,

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const kv = env.HYCU_KV;
    const userNo = env.HYCU_USER_ID;
    if (!userNo) return;

    const sessionData = await getSession(kv);
    if (!sessionData) return;

    const results: AttendResult[] = [];

    try {
      const token = await fetchToken(sessionData.roadCookies);
      const courses = await fetchCoursesWithProgress(token, userNo);

      for (const course of courses) {
        try {
          const lessons = await fetchLessonSchedules(
            sessionData.lmsCookies,
            course.crsCreCd,
            userNo,
          );
          const unattended = lessons.filter(
            (l) => !l.attended || l.progressRatio < 100,
          );

          for (const lesson of unattended) {
            const result = await saveAttendanceRecord(
              sessionData.lmsCookies,
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
            await new Promise((r) => setTimeout(r, 500));
          }
        } catch {
          // Skip course on error
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const eventsRaw = await kv.get(KV_KEYS.events);
      const events: RunEvent[] = eventsRaw ? JSON.parse(eventsRaw) : [];
      events.unshift({
        timestamp: new Date().toISOString(),
        action: 'attend',
        message: `[cron] 출석 처리: ${successCount}/${results.length} 성공`,
        success: successCount > 0,
      });
      if (events.length > 50) events.length = 50;

      ctx.waitUntil(
        Promise.all([
          kv.put(KV_KEYS.events, JSON.stringify(events)),
          (async () => {
            const stateRaw = await kv.get(KV_KEYS.state);
            if (stateRaw) {
              const state = JSON.parse(stateRaw) as DashboardState;
              state.lastAttend = new Date().toISOString();
              await kv.put(KV_KEYS.state, JSON.stringify(state));
            }
          })(),
        ]),
      );
    } catch {
      // Cron failures are silent
    }
  },
};
