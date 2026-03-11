import { describe, expect, it } from 'vitest';
import {
  assertNotSessionRedirect,
  cookiesToHeader,
  parseJsonResponse,
  type PlaywrightCookie,
  type ResponseLike,
} from '../src/cookies-core.js';
import { ApiError, SessionExpiredError } from '../src/errors.js';

function createResponse(body: string, overrides: Partial<ResponseLike> = {}): ResponseLike {
  return {
    ok: true,
    status: 200,
    url: 'https://road.hycu.ac.kr/api',
    async text() {
      return body;
    },
    ...overrides,
  };
}

describe('cookies-core', () => {
  it('filters cookies by exact and dotted domain', () => {
    const cookies: PlaywrightCookie[] = [
      { name: 'road', value: '1', domain: 'road.hycu.ac.kr' },
      { name: 'shared', value: '2', domain: '.road.hycu.ac.kr' },
      { name: 'other', value: '3', domain: 'lms.hycu.ac.kr' },
    ];

    expect(cookiesToHeader(cookies, 'road.hycu.ac.kr')).toBe('road=1; shared=2');
  });

  it('throws when the response redirects to login', () => {
    expect(() =>
      assertNotSessionRedirect({ url: 'https://sso.hycu.ac.kr/Login?returnUrl=foo' }),
    ).toThrow(SessionExpiredError);
  });

  it('parses JSON payloads', async () => {
    await expect(parseJsonResponse<{ ok: boolean }>(createResponse('{"ok":true}'), 'status')).resolves.toEqual({
      ok: true,
    });
  });

  it('rejects HTML bodies as expired sessions', async () => {
    await expect(parseJsonResponse(createResponse('<html>login</html>'), 'status')).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
  });

  it('rejects non-ok responses as API errors', async () => {
    await expect(
      parseJsonResponse(createResponse('{"error":true}', { ok: false, status: 502 }), 'status'),
    ).rejects.toEqual(new ApiError('status: HTTP 502', 502));
  });

  it('rejects invalid JSON payloads', async () => {
    await expect(parseJsonResponse(createResponse('not-json'), 'status')).rejects.toBeInstanceOf(ApiError);
  });
});
