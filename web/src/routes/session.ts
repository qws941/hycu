import { Hono } from 'hono';
import type { AppEnv, SessionData } from '../types';
import { getSession, saveSession, clearSession, checkSession } from '../lib/session';

const app = new Hono<AppEnv>();

app.get('/', async (c) => {
  const kv = c.env.HYCU_KV;
  const session = await getSession(kv);

  if (!session) {
    return c.json({ valid: false, message: '세션 없음. 쿠키를 등록하세요.' });
  }

  const valid = await checkSession(session.roadCookies);
  return c.json({
    valid,
    savedAt: session.savedAt,
    message: valid ? '세션 유효' : '세션 만료. 다시 등록하세요.',
  });
});

app.post('/', async (c) => {
  const kv = c.env.HYCU_KV;
  const body = await c.req.json<{
    roadCookies?: string;
    lmsCookies?: string;
  }>();

  if (!body.roadCookies || !body.lmsCookies) {
    return c.json(
      { error: 'roadCookies와 lmsCookies가 필요합니다.' },
      400,
    );
  }

  const session: SessionData = {
    roadCookies: body.roadCookies,
    lmsCookies: body.lmsCookies,
    savedAt: new Date().toISOString(),
  };

  // NOTE: checkSession skipped on POST — CF Workers IP triggers SSO redirect
  // on road.hycu.ac.kr (IP-bound sessions). Cookies are saved as-is;
  // validity is checked lazily when /api/status or /api/attend uses them.

  await saveSession(kv, session);
  return c.json({
    success: true,
    message: '세션 저장 완료',
    savedAt: session.savedAt,
  });
});

app.delete('/', async (c) => {
  const kv = c.env.HYCU_KV;
  await clearSession(kv);
  return c.json({ success: true, message: '세션 삭제 완료' });
});

export default app;
