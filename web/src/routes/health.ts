import { Hono } from 'hono';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'hycu-dashboard',
    timestamp: new Date().toISOString(),
  });
});

export default app;
