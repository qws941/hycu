import { describe, expect, it, vi } from 'vitest';
import { ApiError, CookieError, SessionExpiredError } from '../src/errors.js';
import {
  authorize,
  createServiceHandler,
  isMutation,
  serializeError,
  type ResponseLike,
  type ServiceDeps,
} from '../src/service-server-core.js';

class MemoryResponse implements ResponseLike {
  status = 0;
  headers: Record<string, string | number> = {};
  body = '';

  writeHead(status: number, headers: Record<string, string | number>): void {
    this.status = status;
    this.headers = headers;
  }

  end(body: string): void {
    this.body = body;
  }

  json(): Record<string, unknown> {
    return JSON.parse(this.body) as Record<string, unknown>;
  }
}

function createDeps(overrides: Partial<ServiceDeps> = {}): ServiceDeps {
  return {
    login: vi.fn(async () => undefined),
    status: vi.fn(async () => [{ course: 'A' }]),
    notices: vi.fn(async () => ({ notices: [] })),
    apiAttend: vi.fn(async () => ({ attended: 1 })),
    ...overrides,
  };
}

describe('service-server-core', () => {
  it('requires a configured API key', () => {
    expect(authorize({ headers: {} }, '')).toEqual({
      ok: false,
      status: 503,
      message: 'HYCU_SERVICE_API_KEY is not configured',
    });
  });

  it('accepts both bearer and x-api-key authentication', () => {
    expect(authorize({ headers: { authorization: 'Bearer token' } }, 'token')).toEqual({ ok: true });
    expect(authorize({ headers: { 'x-api-key': 'token' } }, 'token')).toEqual({ ok: true });
  });

  it('serializes typed errors into HTTP payloads', () => {
    expect(serializeError(new SessionExpiredError('expired'))).toEqual({
      status: 401,
      body: { ok: false, error: 'SessionExpiredError', message: 'expired' },
    });
    expect(serializeError(new CookieError('cookie'))).toEqual({
      status: 401,
      body: { ok: false, error: 'CookieError', message: 'cookie' },
    });
    expect(serializeError(new ApiError('api', 502))).toEqual({
      status: 502,
      body: { ok: false, error: 'ApiError', message: 'api', httpStatus: 502 },
    });
  });

  it('identifies mutation routes', () => {
    expect(isMutation('POST', '/api-attend')).toBe(true);
    expect(isMutation('GET', '/api-attend')).toBe(false);
  });

  it('serves health without authentication', async () => {
    const handler = createServiceHandler(createDeps(), { apiKey: 'secret' });
    const response = new MemoryResponse();

    await handler({ headers: {}, method: 'GET', url: '/healthz' }, response);

    expect(response.status).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: 'hycu-cloudflare' });
  });

  it('rejects unauthorized protected requests', async () => {
    const handler = createServiceHandler(createDeps(), { apiKey: 'secret' });
    const response = new MemoryResponse();

    await handler({ headers: {}, method: 'GET', url: '/status' }, response);

    expect(response.status).toBe(401);
    expect(response.json()).toEqual({ ok: false, message: 'Unauthorized' });
  });

  it('retries status after auto-login refresh', async () => {
    const status = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new SessionExpiredError('expired'))
      .mockResolvedValueOnce([{ course: 'Recovered' }]);
    const login = vi.fn(async () => undefined);
    const handler = createServiceHandler(createDeps({ login, status }), { apiKey: 'secret' });
    const response = new MemoryResponse();

    await handler(
      { headers: { 'x-api-key': 'secret' }, method: 'GET', url: '/status' },
      response,
    );

    expect(login).toHaveBeenCalledTimes(1);
    expect(status).toHaveBeenCalledTimes(2);
    expect(response.status).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      action: 'status',
      courses: [{ course: 'Recovered' }],
    });
  });

  it('returns method errors for protected read endpoints', async () => {
    const handler = createServiceHandler(createDeps(), { apiKey: 'secret' });
    const response = new MemoryResponse();

    await handler(
      { headers: { 'x-api-key': 'secret' }, method: 'POST', url: '/status' },
      response,
    );

    expect(response.status).toBe(405);
    expect(response.json()).toEqual({ ok: false, message: 'Method Not Allowed' });
  });
});
