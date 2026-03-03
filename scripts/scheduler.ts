import '../src/config.js';

const SCHEDULE_HOUR = 17;
const SCHEDULE_MINUTE = 0;

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

async function runAttendance(): Promise<void> {
  console.log(`[scheduler] === Attendance run: ${formatKST(new Date())} ==="`);

  try {
    // Step 1: Refresh session (no-op if still valid)
    console.log('[scheduler] Checking/refreshing session...');
    const { login } = await import('../src/login.js');
    await login();

    // Step 2: Run attendance
    console.log('[scheduler] Running api-attend...');
    const { apiAttend } = await import('../src/api-attend.js');
    await apiAttend();

    console.log('[scheduler] Attendance completed successfully');
  } catch (err) {
    console.error('[scheduler] Attendance failed:', err);
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
