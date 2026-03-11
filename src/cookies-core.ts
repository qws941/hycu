import { ApiError, SessionExpiredError } from './errors.js';

export interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
}

export interface ResponseLike {
  ok: boolean;
  status: number;
  url: string;
  text(): Promise<string>;
}

export function cookiesToHeader(cookies: PlaywrightCookie[], domain: string): string {
  return cookies
    .filter((cookie) => cookie.domain === domain || cookie.domain === `.${domain}`)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

export function assertNotSessionRedirect(res: Pick<ResponseLike, 'url'>): void {
  const { url } = res;
  if (url.includes('sso.hycu.ac.kr') || url.includes('/Login') || url.includes('login.do')) {
    throw new SessionExpiredError(`세션 만료 — API 응답이 로그인 페이지로 리다이렉트됨 (${url})`);
  }
}

export async function parseJsonResponse<T = Record<string, unknown>>(
  res: ResponseLike,
  context: string,
): Promise<T> {
  assertNotSessionRedirect(res);

  if (!res.ok) {
    throw new ApiError(`${context}: HTTP ${res.status}`, res.status);
  }

  const text = await res.text();
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
