import { describe, expect, it } from 'vitest';
import { autoSemester, buildConfig } from '../src/config-core.js';

function createEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    HYCU_USER_ID: 'user',
    HYCU_USER_NAME: 'name',
    FIDO_KEY_ID: 'key-id',
    FIDO_ALG: 'ecdsa',
    FIDO_PRIKEY: 'private-key',
    FIDO_FINGERPRINT: 'fingerprint',
    FIDO_MULTI: 'y',
    FIDO_TYPE: 'pin',
    FIDO_PIN: '123456',
    FIDO_KEYSTORE_JSON: '{"k":"v"}',
    ...overrides,
  };
}

describe('config-core', () => {
  it.each([
    [new Date('2026-03-01T00:00:00Z'), { year: '2026', term: '10' }],
    [new Date('2026-09-01T00:00:00Z'), { year: '2026', term: '20' }],
    [new Date('2026-01-15T00:00:00Z'), { year: '2025', term: '20' }],
  ])('autoSemester(%s) returns %j', (now, expected) => {
    expect(autoSemester(now)).toEqual(expected);
  });

  it('builds config with defaults and overrides', () => {
    const config = buildConfig(
      createEnv({
        HYCU_COOKIE_DIR: 'tmp-cookies',
        HYCU_YEAR: '2030',
        HYCU_SEMESTER: '20',
        SCHEDULE_HOUR: '9',
        SCHEDULE_MINUTE: '45',
        HYCU_DASHBOARD_URL: 'https://dashboard.example.com',
        HYCU_API_KEY: 'dashboard-key',
        HYCU_SERVICE_API_KEY: 'service-key',
        PORT: '9090',
      }),
      new Date('2026-03-01T00:00:00Z'),
    );

    expect(config.paths.cookies.endsWith('tmp-cookies')).toBe(true);
    expect(config.paths.cookieFile.endsWith('tmp-cookies/session.json')).toBe(true);
    expect(config.semester).toEqual({ year: '2030', term: '20' });
    expect(config.schedule).toEqual({ hour: 9, minute: 45 });
    expect(config.dashboard).toEqual({
      url: 'https://dashboard.example.com',
      apiKey: 'dashboard-key',
    });
    expect(config.service).toEqual({ port: 9090, apiKey: 'service-key' });
  });

  it('throws when a required env var is missing', () => {
    const env = createEnv();
    delete env.HYCU_USER_ID;

    expect(() => buildConfig(env, new Date('2026-03-01T00:00:00Z'))).toThrow(
      'Missing env var: HYCU_USER_ID',
    );
  });
});
