import { Hono } from 'hono';
import type { AppEnv } from '../types';

const app = new Hono<AppEnv>();

app.get('/', (c) => {
  return c.json({
    status: 'ok',
    service: 'hycu-dashboard',
    version: '2.0.0-workers',
    timestamp: new Date().toISOString(),
  });
});

export default app;
