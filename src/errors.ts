/**
 * errors.ts
 *
 * Typed error classes for structured error handling across the application.
 * Enables callers (index.ts, scheduler.ts) to differentiate error types
 * and respond appropriately (e.g., session expired → re-login prompt).
 */

/** Session cookies are missing, expired, or rejected by the server. */
export class SessionExpiredError extends Error {
  override readonly name = 'SessionExpiredError';
  constructor(message = '세션 만료 — npm run login 먼저 실행') {
    super(message);
  }
}

/** Cookie file is missing, unreadable, or contains invalid data. */
export class CookieError extends Error {
  override readonly name = 'CookieError';
  constructor(message: string) {
    super(message);
  }
}

/** LMS/Road API returned an unexpected response (non-200, malformed body, etc.). */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}
