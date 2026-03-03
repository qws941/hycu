/**
 * push-cookies.ts
 *
 * Reads Playwright session cookies from cookies/session.json,
 * converts them to header strings grouped by domain,
 * and POSTs to the CF Workers dashboard /api/session endpoint.
 *
 * Usage: npx tsx scripts/push-cookies.ts
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import 'dotenv/config';

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

const COOKIE_FILE = resolve(import.meta.dirname ?? '.', '..', 'cookies', 'session.json');

function cookiesToHeader(cookies: PlaywrightCookie[], domain: string): string {
  return cookies
    .filter((c) => c.domain === domain || c.domain === `.${domain}`)
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
}

async function main() {
  const dashboardUrl = process.env.HYCU_DASHBOARD_URL;
  const apiKey = process.env.HYCU_API_KEY;

  if (!dashboardUrl || !apiKey) {
    console.error('[push-cookies] HYCU_DASHBOARD_URL and HYCU_API_KEY must be set in .env');
    process.exit(1);
  }

  let raw: string;
  try {
    raw = await readFile(COOKIE_FILE, 'utf-8');
  } catch {
    console.error(`[push-cookies] Cookie file not found: ${COOKIE_FILE}`);
    console.error('[push-cookies] Run "npm run login" first to create session cookies.');
    process.exit(1);
  }

  const cookies: PlaywrightCookie[] = JSON.parse(raw);
  console.log(`[push-cookies] Loaded ${cookies.length} cookies from ${COOKIE_FILE}`);

  const roadCookies = cookiesToHeader(cookies, 'road.hycu.ac.kr');
  const lmsCookies = cookiesToHeader(cookies, 'lms.hycu.ac.kr');

  if (!roadCookies) {
    console.error('[push-cookies] No road.hycu.ac.kr cookies found. Session may be expired.');
    process.exit(1);
  }
  if (!lmsCookies) {
    console.error('[push-cookies] No lms.hycu.ac.kr cookies found. Session may be expired.');
    process.exit(1);
  }

  console.log(`[push-cookies] road cookies: ${roadCookies.substring(0, 60)}...`);
  console.log(`[push-cookies] lms cookies: ${lmsCookies.substring(0, 60)}...`);

  const resp = await fetch(`${dashboardUrl}/api/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ roadCookies, lmsCookies }),
  });

  const result = await resp.json();

  if (resp.ok) {
    console.log('[push-cookies] Session pushed successfully:', result);
  } else {
    console.error(`[push-cookies] Failed (${resp.status}):`, result);
    process.exit(1);
  }
}

main();
