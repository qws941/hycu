/**
 * attendance-runner.ts
 *
 * Shared attendance orchestration: login → apiAttend → sync.
 * Used by both the HTTP server (src/server.ts) and the legacy
 * scheduler (scripts/scheduler.ts).
 */

import { SessionExpiredError, CookieError } from './errors.js';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30_000; // 30 seconds

export interface AttendanceResult {
  success: boolean;
  message: string;
  attempts: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run the full attendance cycle: login → apiAttend → dashboard sync.
 *
 * Retries transient failures up to MAX_RETRIES times (30 s delay).
 * SessionExpiredError and CookieError are terminal — re-login inside
 * the same cycle already ran, so retrying won't help.
 */
export async function runAttendanceCycle(): Promise<AttendanceResult> {
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // Step 1: refresh session
      console.log(`[runner] [attempt ${attempt}] Refreshing session...`);
      const { login } = await import('./login.js');
      await login();

      // Step 2: attendance
      console.log(`[runner] [attempt ${attempt}] Running api-attend...`);
      const { apiAttend } = await import('./api-attend.js');
      await apiAttend();

      console.log('[runner] Attendance completed successfully');

      // Step 3: dashboard sync (best-effort)
      try {
        const { syncToDashboard } = await import('./sync.js');
        await syncToDashboard({
          action: 'attend',
          timestamp: new Date().toISOString(),
          success: true,
          message: 'Attendance completed',
        });
      } catch {
        // sync is best-effort
      }

      return { success: true, message: 'Attendance completed', attempts: attempt };
    } catch (err) {
      // Session / cookie errors are terminal — no point retrying
      if (err instanceof SessionExpiredError) {
        console.error(`[runner] Session expired: ${err.message}`);
        await syncFailure(err, attempt);
        return { success: false, message: `Session expired: ${err.message}`, attempts: attempt };
      }
      if (err instanceof CookieError) {
        console.error(`[runner] Cookie error: ${err.message}`);
        await syncFailure(err, attempt);
        return { success: false, message: `Cookie error: ${err.message}`, attempts: attempt };
      }

      console.error(`[runner] Attempt ${attempt} failed:`, err);

      const isLastAttempt = attempt > MAX_RETRIES;
      if (!isLastAttempt) {
        console.log(`[runner] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // Final failure
      await syncFailure(err, attempt);
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg, attempts: attempt };
    }
  }

  // Unreachable — satisfies TypeScript
  return { success: false, message: 'Unexpected exit from retry loop', attempts: MAX_RETRIES + 1 };
}

/** Best-effort dashboard failure sync. */
async function syncFailure(error: unknown, attempt: number): Promise<void> {
  try {
    const { syncToDashboard } = await import('./sync.js');
    await syncToDashboard({
      action: 'attend',
      timestamp: new Date().toISOString(),
      success: false,
      message: `Failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`,
    });
  } catch {
    // sync is best-effort
  }
}
