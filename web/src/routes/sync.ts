import { Hono } from 'hono';
import type { AppEnv, CourseProgress, DashboardState, RunEvent, SyncPayload } from '../types';
import { KV_KEYS } from '../lib/constants';

const app = new Hono<AppEnv>();

const MAX_EVENTS = 50;

app.post('/', async (c) => {
  const kv = c.env.HYCU_KV;

  let payload: SyncPayload;
  try {
    payload = await c.req.json<SyncPayload>();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  if (!payload.action || !payload.timestamp) {
    return c.json({ error: 'Missing action or timestamp' }, 400);
  }

  // Load current state
  const stateRaw = await kv.get(KV_KEYS.state);
  const state: DashboardState = stateRaw
    ? JSON.parse(stateRaw)
    : {
        courses: [],
        lastSync: '',
        lastLogin: null,
        lastAttend: null,
        stats: { totalCourses: 0, completedCourses: 0, overallProgress: 0 },
      };

  // Update state based on action
  state.lastSync = payload.timestamp;

  if (payload.action === 'login') {
    state.lastLogin = payload.timestamp;
  }

  if (payload.action === 'attend') {
    state.lastAttend = payload.timestamp;
  }

  if (payload.courses && payload.courses.length > 0) {
    state.courses = payload.courses;
    const total = state.courses.length;
    const completed = state.courses.filter(
      (cr: CourseProgress) => cr.progressRatio >= 100,
    ).length;
    const avgProgress =
      total > 0
        ? Math.round(
            state.courses.reduce(
              (sum: number, cr: CourseProgress) => sum + cr.progressRatio,
              0,
            ) / total,
          )
        : 0;
    state.stats = {
      totalCourses: total,
      completedCourses: completed,
      overallProgress: avgProgress,
    };
  }

  // Append event
  const eventsRaw = await kv.get(KV_KEYS.events);
  const events: RunEvent[] = eventsRaw ? JSON.parse(eventsRaw) : [];

  events.unshift({
    timestamp: payload.timestamp,
    action: payload.action,
    message: payload.message ?? `${payload.action} completed`,
    success: payload.success ?? true,
  });

  if (events.length > MAX_EVENTS) {
    events.length = MAX_EVENTS;
  }

  // Persist
  c.executionCtx.waitUntil(
    Promise.all([
      kv.put(KV_KEYS.state, JSON.stringify(state)),
      kv.put(KV_KEYS.events, JSON.stringify(events)),
    ]),
  );

  return c.json({ ok: true, state });
});

export default app;
