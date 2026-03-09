/**
 * cookies.ts
 *
 * Consolidated cookie loading, token fetching, and API response utilities.
 * Eliminates duplication between api-attend.ts and notices.ts.
 */

import { readFile } from 'node:fs/promises';
import { config } from './config.js';
import { CookieError, SessionExpiredError, ApiError } from './errors.js';

const ROAD = config.urls.road;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
}

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

/** Extract cookies for a specific domain as a Cookie header string. */
export function cookiesToHeader(cookies: PlaywrightCookie[], domain: string): string {
  return cookies
    .filter((c) => c.domain === domain || c.domain === `.${domain}`)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
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

// ---------------------------------------------------------------------------
// Response safety utilities
// ---------------------------------------------------------------------------

/**
 * Check if a fetch response was redirected to SSO login page.
 * LMS/Road APIs return 200 with HTML body on session expiry instead of 401.
 */
export function assertNotSessionRedirect(res: Response): void {
  const url = res.url;
  if (url.includes('sso.hycu.ac.kr') || url.includes('/Login') || url.includes('login.do')) {
    throw new SessionExpiredError(`세션 만료 — API 응답이 로그인 페이지로 리다이렉트됨 (${url})`);
  }
}

/**
 * Parse a fetch response as JSON with session expiry and HTML detection.
 * Throws SessionExpiredError if response is a login redirect.
 * Throws ApiError if response body is HTML or unparseable.
 */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response,
  context: string,
): Promise<T> {
  assertNotSessionRedirect(res);

  if (!res.ok) {
    throw new ApiError(`${context}: HTTP ${res.status}`, res.status);
  }

  const text = await res.text();

  // Detect HTML response (session expired returns HTML login page with 200 OK)
  if (text.trimStart().startsWith('<')) {
    throw new SessionExpiredError(
      `${context}: API가 HTML 반환 (세션 만료 가능) — 처음 100자: ${text.slice(0, 100)}`,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(`${context}: JSON 파싱 실패 — ${text.slice(0, 200)}`);
  }
}
