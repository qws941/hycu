/**
 * cookies.ts
 *
 * Consolidated cookie loading, token fetching, and API response utilities.
 * Eliminates duplication between api-attend.ts and notices.ts.
 */

import { readFile } from 'node:fs/promises';
import { config } from './config.js';
import { CookieError, SessionExpiredError, ApiError } from './errors.js';
import {
  assertNotSessionRedirect,
  cookiesToHeader,
  parseJsonResponse,
  type PlaywrightCookie,
} from './cookies-core.js';

const ROAD = config.urls.road;

export { assertNotSessionRedirect, cookiesToHeader, parseJsonResponse } from './cookies-core.js';
export type { PlaywrightCookie } from './cookies-core.js';

// ---------------------------------------------------------------------------
// Cookie loading
// ---------------------------------------------------------------------------

/** Load cookies from Playwright session.json with proper error handling. */
export async function loadCookies(): Promise<PlaywrightCookie[]> {
  let raw: string;
  try {
    raw = await readFile(config.paths.cookieFile, 'utf-8');
  } catch (err) {
    throw new CookieError(
      `쿠키 파일 없음 (${config.paths.cookieFile}) — npm run login 먼저 실행`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CookieError(`쿠키 파일 파싱 실패 — 파일이 손상됨 (${config.paths.cookieFile})`);
  }

  // Handle both array format and { cookies: [...] } format
  const cookies: PlaywrightCookie[] = Array.isArray(parsed)
    ? parsed
    : (parsed as { cookies?: PlaywrightCookie[] }).cookies ?? [];

  if (cookies.length === 0) {
    throw new CookieError('쿠키 파일에 유효한 쿠키 없음 — npm run login 먼저 실행');
  }

  return cookies;
}

/** Load cookies and return formatted headers for Road + LMS domains. */
export async function loadCookieHeaders(): Promise<{ roadCookies: string; lmsCookies: string }> {
  const cookies = await loadCookies();
  const roadCookies = cookiesToHeader(cookies, new URL(config.urls.road).hostname);
  const lmsCookies = cookiesToHeader(cookies, new URL(config.urls.lms).hostname);

  if (!roadCookies) {
    throw new SessionExpiredError('Road 쿠키 없음 — npm run login 먼저 실행');
  }

  return { roadCookies, lmsCookies };
}

// ---------------------------------------------------------------------------
// Token fetching
// ---------------------------------------------------------------------------

/** Fetch LMS auth token from Road API. */
export async function fetchToken(roadCookies: string): Promise<string> {
  const res = await fetch(`${ROAD}/pot/MainCtr/findToken.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: roadCookies,
    },
    body: 'gubun=lms',
  });

  assertNotSessionRedirect(res);

  const raw = (await res.text()).trim();
  let token = raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.token === 'string') token = parsed.token;
  } catch {
    // plain text token — use as-is
  }

  if (!token || token.length < 10) {
    throw new ApiError(`유효하지 않은 토큰: ${token.substring(0, 50)}`);
  }

  return token;
}
