import { resolve } from 'node:path';

export interface Semester {
  year: string;
  term: string;
}

export interface AppConfig {
  userId: string;
  userName: string;
  fido: {
    keyId: string;
    alg: string;
    prikey: string;
    fingerprint: string;
    multi: string;
    type: string;
    pin: string;
    keyStoreJson: string;
  };
  urls: {
    road: string;
    sso: string;
    idp: string;
    lms: string;
    fido: string;
  };
  paths: {
    cookies: string;
    cookieFile: string;
  };
  semester: Semester;
  schedule: {
    hour: number;
    minute: number;
  };
  dashboard: {
    url: string;
    apiKey: string;
  };
  service: {
    port: number;
    apiKey: string;
  };
}

export function env(key: string, source: NodeJS.ProcessEnv): string {
  const value = source[key];
  if (!value) {
    throw new Error(`Missing env var: ${key}`);
  }
  return value;
}

export function optEnv(key: string, fallback: string, source: NodeJS.ProcessEnv): string {
  return source[key] || fallback;
}

export function autoSemester(now: Date): Semester {
  const month = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  if (month >= 3 && month <= 8) {
    return { year: String(currentYear), term: '10' };
  }
  if (month >= 9) {
    return { year: String(currentYear), term: '20' };
  }
  return { year: String(currentYear - 1), term: '20' };
}

export function buildConfig(source: NodeJS.ProcessEnv, now: Date = new Date()): AppConfig {
  const defaultSemester = autoSemester(now);
  const cookieDir = optEnv('HYCU_COOKIE_DIR', 'cookies', source);

  return {
    userId: env('HYCU_USER_ID', source),
    userName: env('HYCU_USER_NAME', source),
    fido: {
      keyId: env('FIDO_KEY_ID', source),
      alg: env('FIDO_ALG', source),
      prikey: env('FIDO_PRIKEY', source),
      fingerprint: env('FIDO_FINGERPRINT', source),
      multi: env('FIDO_MULTI', source),
      type: env('FIDO_TYPE', source),
      pin: env('FIDO_PIN', source),
      keyStoreJson: env('FIDO_KEYSTORE_JSON', source),
    },
    urls: {
      road: 'https://road.hycu.ac.kr',
      sso: 'https://sso.hycu.ac.kr',
      idp: 'https://idp.hycu.ac.kr',
      lms: 'https://lms.hycu.ac.kr',
      fido: 'https://fido.hycu.ac.kr:28444',
    },
    paths: {
      cookies: resolve(cookieDir),
      cookieFile: resolve(cookieDir, 'session.json'),
    },
    semester: {
      year: optEnv('HYCU_YEAR', defaultSemester.year, source),
      term: optEnv('HYCU_SEMESTER', defaultSemester.term, source),
    },
    schedule: {
      hour: Number(optEnv('SCHEDULE_HOUR', '17', source)),
      minute: Number(optEnv('SCHEDULE_MINUTE', '0', source)),
    },
    dashboard: {
      url: optEnv('HYCU_DASHBOARD_URL', 'https://hycu.jclee.me', source),
      apiKey: optEnv('HYCU_API_KEY', '', source),
    },
    service: {
      port: Number(optEnv('PORT', '8080', source)),
      apiKey: optEnv('HYCU_SERVICE_API_KEY', '', source),
    },
  };
}
