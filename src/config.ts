import 'dotenv/config';
import { resolve } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
}

function optEnv(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

/** Auto-detect academic semester from current date. */
function autoSemester(): { year: string; term: string } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Month 3-8 → 1학기 (10), Month 9-12 → 2학기 (20), Month 1-2 → 2학기 of previous year
  if (month >= 3 && month <= 8) {
    return { year: String(currentYear), term: '10' };
  }
  if (month >= 9) {
    return { year: String(currentYear), term: '20' };
  }
  // January-February: still 2학기 of previous year
  return { year: String(currentYear - 1), term: '20' };
}

const defaultSemester = autoSemester();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const config = {
  userId: env('HYCU_USER_ID'),
  userName: env('HYCU_USER_NAME'),

  fido: {
    keyId: env('FIDO_KEY_ID'),
    alg: env('FIDO_ALG'),
    prikey: env('FIDO_PRIKEY'),
    fingerprint: env('FIDO_FINGERPRINT'),
    multi: env('FIDO_MULTI'),
    type: env('FIDO_TYPE'),
    pin: env('FIDO_PIN'),
    keyStoreJson: env('FIDO_KEYSTORE_JSON'),
  },

  urls: {
    road: 'https://road.hycu.ac.kr',
    sso: 'https://sso.hycu.ac.kr',
    idp: 'https://idp.hycu.ac.kr',
    lms: 'https://lms.hycu.ac.kr',
    fido: 'https://fido.hycu.ac.kr:28444',
  },

  paths: {
    cookies: resolve('cookies'),
    cookieFile: resolve('cookies', 'session.json'),
  },

  semester: {
    year: optEnv('HYCU_YEAR', defaultSemester.year),
    term: optEnv('HYCU_SEMESTER', defaultSemester.term),
  },

  schedule: {
    hour: Number(optEnv('SCHEDULE_HOUR', '17')),
    minute: Number(optEnv('SCHEDULE_MINUTE', '0')),
  },

  dashboard: {
    url: optEnv('HYCU_DASHBOARD_URL', 'https://hycu.jclee.me'),
    apiKey: optEnv('HYCU_API_KEY', ''),
  },
} as const;
