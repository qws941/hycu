import { Hono } from 'hono';
import type { Context } from 'hono';
import type { AppEnv, DashboardState } from '../types';
import { getSession, checkSession } from '../lib/session';
import { fetchToken, fetchCoursesWithProgress } from '../lib/lms';
import { KV_KEYS } from '../lib/constants';

const app = new Hono<AppEnv>();

async function serveCachedState(
  c: Context<AppEnv>,
  error?: string,
) {
  const kv = c.env.HYCU_KV;
  const [stateRaw, eventsRaw] = await Promise.all([
    kv.get(KV_KEYS.state),
    kv.get(KV_KEYS.events),
  ]);

  const state: DashboardState = stateRaw
    ? JSON.parse(stateRaw)
    : {
        courses: [],
        lastSync: '',
        lastLogin: null,
        lastAttend: null,
        stats: { totalCourses: 0, completedCourses: 0, overallProgress: 0 },
      };

  const events = eventsRaw ? JSON.parse(eventsRaw) : [];
  return c.json({ state, events, cached: true, error });
}

app.get('/', async (c) => {
  const kv = c.env.HYCU_KV;
  const userNo = c.env.HYCU_USER_ID;

  if (!userNo) {
    return serveCachedState(c);
  }

  const session = await getSession(kv);
  if (!session) {
    return serveCachedState(c);
  }

  const forceRefresh = c.req.query('refresh') === 'true';

  if (!forceRefresh) {
    const cached = await kv.get(KV_KEYS.state);
    if (cached) {
      const prev = JSON.parse(cached) as DashboardState;
      const age = Date.now() - new Date(prev.lastSync).getTime();
      if (age < 5 * 60 * 1000) {
        const events = await kv.get(KV_KEYS.events);
        return c.json({
          state: prev,
          events: events ? JSON.parse(events) : [],
          cached: true,
        });
      }
    }
  }

  try {
    const valid = await checkSession(session.roadCookies);
    if (!valid) {
      return serveCachedState(c, '세션 만료');
    }

    const token = await fetchToken(session.roadCookies);
    const courses = await fetchCoursesWithProgress(token, userNo);

    const totalCourses = courses.length;
    const completedCourses = courses.filter((cr) => cr.progressRatio >= 100).length;
    const overallProgress =
      totalCourses > 0
        ? Math.round(courses.reduce((s, cr) => s + cr.progressRatio, 0) / totalCourses)
        : 0;

    const prevRaw = await kv.get(KV_KEYS.state);
    const prev = prevRaw ? (JSON.parse(prevRaw) as DashboardState) : null;

    const state: DashboardState = {
      courses,
      lastSync: new Date().toISOString(),
      lastLogin: prev?.lastLogin ?? null,
      lastAttend: prev?.lastAttend ?? null,
      stats: { totalCourses, completedCourses, overallProgress },
    };

    c.executionCtx.waitUntil(kv.put(KV_KEYS.state, JSON.stringify(state)));

    const events = await kv.get(KV_KEYS.events);
    return c.json({
      state,
      events: events ? JSON.parse(events) : [],
      cached: false,
    });
  } catch (err) {
    return serveCachedState(c, `조회 실패: ${err}`);
  }
});

export default app;
