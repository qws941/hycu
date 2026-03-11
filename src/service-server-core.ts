import { ApiError, CookieError, SessionExpiredError } from './errors.js';
import type { apiAttend } from './api-attend.js';
import type { login } from './login.js';
import type { notices } from './notices.js';
import type { status } from './status.js';

export type AuthResult = { ok: true } | { ok: false; status: number; message: string };

export interface RequestLike {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
}

export interface ResponseLike {
  writeHead(status: number, headers: Record<string, string | number>): void;
  end(body: string): void;
}

export interface ServiceDeps {
  login: typeof login;
  status: typeof status;
  notices: typeof notices;
  apiAttend: typeof apiAttend;
}

export interface ServiceOptions {
  apiKey: string;
  serviceName?: string;
  runSerialized?: <T>(task: () => Promise<T>) => Promise<T>;
  logger?: Pick<Console, 'log'>;
}

export function getHeader(req: RequestLike, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

export function json(res: ResponseLike, status: number, payload: unknown): void {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

export function authorize(req: RequestLike, apiKey: string): AuthResult {
  if (!apiKey) {
    return { ok: false, status: 503, message: 'HYCU_SERVICE_API_KEY is not configured' };
  }

  const bearer = getHeader(req, 'authorization');
  const explicit = getHeader(req, 'x-api-key');
  const token = explicit ?? (bearer?.startsWith('Bearer ') ? bearer.slice(7) : undefined);

  if (token !== apiKey) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  return { ok: true };
}

export async function withAutoLogin<T>(
  label: string,
  task: () => Promise<T>,
  loginTask: () => Promise<void>,
  logger: Pick<Console, 'log'> = console,
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof SessionExpiredError || error instanceof CookieError) {
      logger.log(`[service] ${label}: refreshing session via login()`);
      await loginTask();
      return task();
    }
    throw error;
  }
}

export function serializeError(error: unknown): { status: number; body: Record<string, unknown> } {
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

export function isMutation(method: string | undefined, pathname: string): boolean {
  return method === 'POST' && pathname === '/api-attend';
}

export function createServiceHandler(deps: ServiceDeps, options: ServiceOptions) {
  const serviceName = options.serviceName ?? 'hycu-cloudflare';
  const logger = options.logger ?? console;
  const runSerialized = options.runSerialized ?? (async <T>(task: () => Promise<T>) => task());

  return async function handle(req: RequestLike, res: ResponseLike): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const method = req.method ?? 'GET';

    if (
      method === 'GET' &&
      (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/healthz' || url.pathname === '/ping')
    ) {
      json(res, 200, { ok: true, service: serviceName });
      return;
    }

    const auth = authorize(req, options.apiKey);
    if (!auth.ok) {
      json(res, auth.status, { ok: false, message: auth.message });
      return;
    }

    try {
      const result = await runSerialized(async () => {
        if (method === 'GET' && url.pathname === '/status') {
          const courses = await withAutoLogin('status', () => deps.status(), deps.login, logger);
          return { status: 200, body: { ok: true, action: 'status', courses } };
        }

        if (method === 'GET' && url.pathname === '/notices') {
          const data = await withAutoLogin('notices', () => deps.notices(), deps.login, logger);
          return { status: 200, body: { ok: true, action: 'notices', ...data } };
        }

        if (method === 'POST' && url.pathname === '/api-attend') {
          const summary = await withAutoLogin('api-attend', () => deps.apiAttend(), deps.login, logger);
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
  };
}
