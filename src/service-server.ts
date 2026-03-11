import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.js';
import { login } from './login.js';
import { status } from './status.js';
import { notices } from './notices.js';
import { apiAttend } from './api-attend.js';
import { ApiError, CookieError, SessionExpiredError } from './errors.js';

type AuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

let queue: Promise<void> = Promise.resolve();

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function json(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function authorize(req: IncomingMessage): AuthResult {
  if (!config.service.apiKey) {
    return {
      ok: false,
      status: 503,
      message: 'HYCU_SERVICE_API_KEY is not configured',
    };
  }

  const bearer = getHeader(req, 'authorization');
  const explicit = getHeader(req, 'x-api-key');
  const token = explicit ?? (bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined);

  if (token !== config.service.apiKey) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true };
}

async function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();
  }
}

async function withAutoLogin<T>(label: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof SessionExpiredError || error instanceof CookieError) {
      console.log(`[service] ${label}: refreshing session via login()`);
      await login();
      return task();
    }
    throw error;
  }
}

function serializeError(error: unknown): { status: number; body: Record<string, unknown> } {
  if (error instanceof SessionExpiredError) {
    return { status: 401, body: { ok: false, error: error.name, message: error.message } };
  }

  if (error instanceof CookieError) {
    return { status: 401, body: { ok: false, error: error.name, message: error.message } };
  }

  if (error instanceof ApiError) {
    return {
      status: 502,
      body: { ok: false, error: error.name, message: error.message, httpStatus: error.status },
    };
  }

  if (error instanceof Error) {
    return { status: 500, body: { ok: false, error: error.name, message: error.message } };
  }

  return { status: 500, body: { ok: false, error: 'UnknownError', message: String(error) } };
}

function isMutation(method: string | undefined, pathname: string): boolean {
  return method === 'POST' && pathname === '/api-attend';
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';

  if (
    method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/healthz' || url.pathname === '/ping')
  ) {
    json(res, 200, {
      ok: true,
      service: 'hycu-cloudflare',
    });
    return;
  }

  const auth = authorize(req);
  if (!auth.ok) {
    json(res, auth.status, { ok: false, message: auth.message });
    return;
  }

  try {
    const result = await runSerialized(async () => {
      if (method === 'GET' && url.pathname === '/status') {
        const courses = await withAutoLogin('status', () => status());
        return { status: 200, body: { ok: true, action: 'status', courses } };
      }

      if (method === 'GET' && url.pathname === '/notices') {
        const data = await withAutoLogin('notices', () => notices());
        return { status: 200, body: { ok: true, action: 'notices', ...data } };
      }

      if (method === 'POST' && url.pathname === '/api-attend') {
        const summary = await withAutoLogin('api-attend', () => apiAttend());
        return { status: 200, body: { ok: true, action: 'api-attend', summary } };
      }

      if (isMutation(method, url.pathname)) {
        return { status: 405, body: { ok: false, message: 'Method Not Allowed' } };
      }

      if (url.pathname === '/status' || url.pathname === '/notices') {
        return { status: 405, body: { ok: false, message: 'Method Not Allowed' } };
      }

      return { status: 404, body: { ok: false, message: 'Not Found' } };
    });

    json(res, result.status, result.body);
  } catch (error) {
    const failure = serializeError(error);
    json(res, failure.status, failure.body);
  }
}

const server = createServer((req, res) => {
  handle(req, res).catch((error) => {
    const failure = serializeError(error);
    json(res, failure.status, failure.body);
  });
});

server.listen(config.service.port, () => {
  console.log(`[service] listening on :${config.service.port}`);
});
