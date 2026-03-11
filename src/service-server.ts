import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { login } from './login.js';
import { status } from './status.js';
import { notices } from './notices.js';
import { apiAttend } from './api-attend.js';
import { createServiceHandler, json, serializeError, type ServiceDeps } from './service-server-core.js';

let queue: Promise<void> = Promise.resolve();

async function runSerialized<T>(task: () => Promise<T>): Promise<T> {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>((resolve) => {
    release = resolve;
  });

  await previous.catch(() => undefined);

  try {
    return await task();
  } finally {
    release();
  }
}

const deps: ServiceDeps = {
  login,
  status,
  notices,
  apiAttend,
};

export function createServiceServer() {
  const handle = createServiceHandler(deps, {
    apiKey: config.service.apiKey,
    serviceName: 'hycu-cloudflare',
    runSerialized,
  });

  return createServer((req, res) => {
    handle(req, res).catch((error) => {
      const failure = serializeError(error);
      json(res, failure.status, failure.body);
    });
  });
}

export function startServiceServer(port = config.service.port) {
  const server = createServiceServer();
  server.listen(port, () => {
    console.log(`[service] listening on :${port}`);
  });
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startServiceServer();
}
