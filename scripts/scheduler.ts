import { config } from '../src/config.js';
import { SessionExpiredError, CookieError } from '../src/errors.js';

const SCHEDULE_HOUR = config.schedule.hour;
const SCHEDULE_MINUTE = config.schedule.minute;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 30_000; // 30 seconds

function getNextRun(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SCHEDULE_HOUR, SCHEDULE_MINUTE, 0, 0);

  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }

  // Skip weekends (Sat=6, Sun=0)
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function formatKST(date: Date): string {
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function syncFailure(error: unknown, attempt: number): Promise<void> {
  try {
    const { syncToDashboard } = await import('../src/sync.js');
    await syncToDashboard({
      action: 'attend',
      timestamp: new Date().toISOString(),
      success: false,
      message: `Scheduler failed (attempt ${attempt}): ${error instanceof Error ? error.message : String(error)}`,
    });
  } catch {
    // sync is best-effort
  }
}

async function runAttendance(): Promise<void> {
  console.log(`[scheduler] === Attendance run: ${formatKST(new Date())} ===`);

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    try {
      // Step 1: Refresh session
      console.log(`[scheduler] [attempt ${attempt}] Checking/refreshing session...`);
      const { login } = await import('../src/login.js');
      await login();

      // Step 2: Run attendance
      console.log(`[scheduler] [attempt ${attempt}] Running api-attend...`);
      const { apiAttend } = await import('../src/api-attend.js');
      await apiAttend();

      console.log('[scheduler] Attendance completed successfully');

      // Sync success to dashboard
      try {
        const { syncToDashboard } = await import('../src/sync.js');
        await syncToDashboard({
          action: 'attend',
          timestamp: new Date().toISOString(),
          success: true,
          message: 'Scheduled attendance completed',
        });
      } catch {
        // sync is best-effort
      }
      return; // success — exit retry loop
    } catch (err) {
      const isRetryable = !(err instanceof SessionExpiredError) && !(err instanceof CookieError);
      const isLastAttempt = attempt > MAX_RETRIES;

      if (err instanceof SessionExpiredError) {
        console.error(`[scheduler] Session expired: ${err.message}`);
        console.error('[scheduler] Login should have refreshed — possible FIDO key issue');
      } else if (err instanceof CookieError) {
        console.error(`[scheduler] Cookie error: ${err.message}`);
      } else {
        console.error(`[scheduler] Attempt ${attempt} failed:`, err);
      }

      if (isRetryable && !isLastAttempt) {
        console.log(`[scheduler] Retrying in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      // Final failure — sync to dashboard
      await syncFailure(err, attempt);
      console.error(`[scheduler] All attempts exhausted. Next scheduled run will retry.`);
      return;
    }
  }
}

function scheduleNext(): void {
  const next = getNextRun();
  const delay = next.getTime() - Date.now();
  const hours = Math.floor(delay / 3600000);
  const minutes = Math.round((delay % 3600000) / 60000);

  console.log(`[scheduler] Next run: ${formatKST(next)} (${hours}h ${minutes}m)`);

  setTimeout(async () => {
    await runAttendance();
    scheduleNext();
  }, delay);
}

console.log('[scheduler] HYCU attendance scheduler started');
console.log(`[scheduler] Schedule: weekdays ${SCHEDULE_HOUR}:${String(SCHEDULE_MINUTE).padStart(2, '0')} KST`);
console.log(`[scheduler] Current time: ${formatKST(new Date())}`);
console.log(`[scheduler] Max retries: ${MAX_RETRIES} (${RETRY_DELAY_MS / 1000}s delay)`);

if (process.argv.includes('--now')) {
  console.log('[scheduler] --now flag detected, running immediately');
  runAttendance().then(() => scheduleNext());
} else {
  scheduleNext();
}

process.on('SIGTERM', () => {
  console.log('[scheduler] Received SIGTERM, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[scheduler] Received SIGINT, shutting down');
  process.exit(0);
});
