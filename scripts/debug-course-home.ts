import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import path from 'path';

const ROAD = 'https://road.hycu.ac.kr';
const LMS = 'https://lms.hycu.ac.kr';
const COURSE = '202610CCP06401';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });

  // Load cookies from session.json (same as CLI browser.ts)
  const cookieFile = path.resolve('cookies/session.json');
  try {
    const raw = readFileSync(cookieFile, 'utf-8');
    const cookies = JSON.parse(raw);
    await ctx.addCookies(cookies);
    console.log(`[debug] loaded ${cookies.length} cookies from session.json`);
  } catch {
    console.log('[debug] no session.json found — run login first');
    await browser.close();
    process.exit(1);
  }

  const page = await ctx.newPage();

  console.log('[debug] navigating to road mainView...');
  await page.goto(`${ROAD}/pot/MainCtr/mainView.do`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  if (page.url().includes('sso.hycu.ac.kr')) {
    console.log('[debug] session expired');
    await browser.close();
    process.exit(1);
  }
  console.log('[debug] road session valid');

  console.log(`[debug] navigating to course home: ${COURSE}`);
  await page.goto(`${LMS}/crs/crsHomeStd.do?crsCreCd=${COURSE}`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });

  const url = page.url();
  console.log('[debug] course home URL:', url);

  if (url.includes('sso.hycu.ac.kr')) {
    console.log('[debug] LMS redirected to SSO');
    await browser.close();
    process.exit(1);
  }

  // Capture LESSON_SCHEDULE_LIST JS variable (populated by AJAX on page load)
  const scheduleList = await page.evaluate(() => {
    return (window as any).LESSON_SCHEDULE_LIST || [];
  });
  console.log(`[debug] LESSON_SCHEDULE_LIST has ${scheduleList.length} items`);
  console.log(JSON.stringify(scheduleList, null, 2));

  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
