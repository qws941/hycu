import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../types';

export const authMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  // Health endpoint bypasses auth
  if (c.req.path === '/api/health') {
    return next();
  }

  // Only POST and DELETE require auth
  const method = c.req.method;
  if (method !== 'POST' && method !== 'DELETE') {
    return next();
  }

  const apiKey = c.env.API_KEY;
  if (!apiKey) {
    return c.json({ error: 'API_KEY가 설정되지 않았습니다.' }, 500);
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  return next();
});
