import { Container, getContainer } from '@cloudflare/containers';

export class HycuContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '20m';

  constructor(ctx, workerEnv) {
    super(ctx, workerEnv);
    this.envVars = buildContainerEnv(workerEnv);
  }
}

function buildContainerEnv(workerEnv) {
  return {
    PORT: workerEnv.PORT ?? '8080',
    TZ: workerEnv.TZ ?? 'Asia/Seoul',
    HYCU_COOKIE_DIR: workerEnv.HYCU_COOKIE_DIR ?? '/tmp/hycu-cookies',
    HYCU_SERVICE_API_KEY: workerEnv.HYCU_SERVICE_API_KEY ?? '',
    HYCU_USER_ID: workerEnv.HYCU_USER_ID ?? '',
    HYCU_USER_NAME: workerEnv.HYCU_USER_NAME ?? '',
    FIDO_KEY_ID: workerEnv.FIDO_KEY_ID ?? '',
    FIDO_ALG: workerEnv.FIDO_ALG ?? '',
    FIDO_PRIKEY: workerEnv.FIDO_PRIKEY ?? '',
    FIDO_FINGERPRINT: workerEnv.FIDO_FINGERPRINT ?? '',
    FIDO_MULTI: workerEnv.FIDO_MULTI ?? '',
    FIDO_TYPE: workerEnv.FIDO_TYPE ?? '',
    FIDO_PIN: workerEnv.FIDO_PIN ?? '',
    FIDO_KEYSTORE_JSON: workerEnv.FIDO_KEYSTORE_JSON ?? '',
    HYCU_YEAR: workerEnv.HYCU_YEAR ?? '',
    HYCU_SEMESTER: workerEnv.HYCU_SEMESTER ?? '',
    HYCU_DASHBOARD_URL: workerEnv.HYCU_DASHBOARD_URL ?? '',
    HYCU_API_KEY: workerEnv.HYCU_API_KEY ?? '',
    HYCU_RUNTIME_VERSION: workerEnv.HYCU_RUNTIME_VERSION ?? '',
  };
}

async function getHycuContainer(workerEnv) {
  const runtimeVersion = workerEnv.HYCU_RUNTIME_VERSION || 'runtime-default';
  const container = getContainer(workerEnv.HYCU_CONTAINER, `hycu-service-${runtimeVersion}`);
  await container.startAndWaitForPorts({
    ports: [8080],
    startOptions: {
      envVars: buildContainerEnv(workerEnv),
    },
  });
  return container;
}

export default {
  async fetch(request, workerEnv) {
    const container = await getHycuContainer(workerEnv);
    return container.fetch(request);
  },

  async scheduled(_controller, workerEnv, ctx) {
    ctx.waitUntil((async () => {
      if (!workerEnv.HYCU_SERVICE_API_KEY) {
        throw new Error('HYCU_SERVICE_API_KEY is required for scheduled attendance');
      }

      const container = await getHycuContainer(workerEnv);
      const request = new Request('https://hycu.internal/api-attend', {
        method: 'POST',
        headers: {
          'x-api-key': workerEnv.HYCU_SERVICE_API_KEY,
          'user-agent': 'hycu-cloudflare-cron',
        },
      });

      const response = await container.fetch(request);
      const body = await response.text();

      if (!response.ok) {
        throw new Error(`Scheduled attendance failed: ${response.status} ${body.slice(0, 500)}`);
      }

      console.log(`[cron] attendance ok ${response.status}`);
      console.log(body.slice(0, 500));
    })());
  },
};
