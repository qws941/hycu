/**
 * server.ts
 *
 * HTTP service exposing HYCU attendance operations to external
 * orchestrators (n8n, cron, dashboards).  Uses only node:http —
 * no additional dependencies.
 *
 * Endpoints:
 *   GET  /api/health  — unauthenticated health probe
 *   POST /api/run     — full cycle (login → attend → sync) with retries
 *   POST /api/login   — login only
 *   POST /api/attend  — attend only (requires existing session)
 *
 * Auth: x-api-key header checked against HYCU_SERVICE_API_KEY.
 *       If the env var is empty, all endpoints are open.
 *
 * Concurrency: simple in-memory mutex — one operation at a time.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.js';
import { SessionExpiredError, CookieError, ApiError } from './errors.js';
import { runAttendanceCycle } from './attendance-runner.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApiResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
  duration: number;
}

// ---------------------------------------------------------------------------
// Mutex — single-container, in-memory
// ---------------------------------------------------------------------------

let busy = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function json(res: ServerResponse, status: number, body: ApiResponse): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function checkAuth(req: IncomingMessage): boolean {
  const apiKey = config.service.apiKey;
  if (!apiKey) return true; // no key configured → open (local dev)
  return req.headers['x-api-key'] === apiKey;
}

function mapError(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof SessionExpiredError) {
    return { status: 401, code: 'SESSION_EXPIRED', message: err.message };
  }
  if (err instanceof CookieError) {
    return { status: 401, code: 'COOKIE_ERROR', message: err.message };
  }
  if (err instanceof ApiError) {
    return { status: 502, code: 'API_ERROR', message: err.message };
  }
  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : String(err),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

function handleHealth(res: ServerResponse): void {
  json(res, 200, { success: true, data: { status: 'ok', busy }, duration: 0 });
}

async function handleRun(res: ServerResponse): Promise<void> {
  if (busy) {
    json(res, 409, {
      success: false,
      error: { code: 'BUSY', message: 'Another run is in progress' },
      duration: 0,
    });
    return;
  }

  busy = true;
  const start = Date.now();

  try {
    const result = await runAttendanceCycle();
    const duration = Date.now() - start;

    if (result.success) {
      json(res, 200, {
        success: true,
        data: { message: result.message, attempts: result.attempts },
        duration,
      });
    } else {
      // Determine HTTP status from error message
      const isSessionError =
        result.message.includes('Session expired') || result.message.includes('Cookie error');
      const status = isSessionError ? 401 : 502;
      const code = isSessionError ? 'SESSION_ERROR' : 'ATTEND_FAILED';
      json(res, status, { success: false, error: { code, message: result.message }, duration });
    }
  } catch (err) {
    const duration = Date.now() - start;
    const mapped = mapError(err);
    json(res, mapped.status, {
      success: false,
      error: { code: mapped.code, message: mapped.message },
      duration,
    });
  } finally {
    busy = false;
  }
}

async function handleLogin(res: ServerResponse): Promise<void> {
  if (busy) {
    json(res, 409, {
      success: false,
      error: { code: 'BUSY', message: 'Another operation is in progress' },
      duration: 0,
    });
    return;
  }

  busy = true;
  const start = Date.now();

  try {
    const { login } = await import('./login.js');
    await login();
    json(res, 200, { success: true, data: { message: 'Login completed' }, duration: Date.now() - start });
  } catch (err) {
    const duration = Date.now() - start;
    const mapped = mapError(err);
    json(res, mapped.status, { success: false, error: { code: mapped.code, message: mapped.message }, duration });
  } finally {
    busy = false;
  }
}

async function handleAttend(res: ServerResponse): Promise<void> {
  if (busy) {
    json(res, 409, {
      success: false,
      error: { code: 'BUSY', message: 'Another operation is in progress' },
      duration: 0,
    });
    return;
  }

  busy = true;
  const start = Date.now();

  try {
    const { apiAttend } = await import('./api-attend.js');
    await apiAttend();

    // Sync success (best-effort)
    try {
      const { syncToDashboard } = await import('./sync.js');
      await syncToDashboard({
        action: 'attend',
        timestamp: new Date().toISOString(),
        success: true,
        message: 'API attendance completed',
      });
    } catch {
      // best-effort
    }

    json(res, 200, { success: true, data: { message: 'Attendance completed' }, duration: Date.now() - start });
  } catch (err) {
    const duration = Date.now() - start;
    const mapped = mapError(err);
    json(res, mapped.status, { success: false, error: { code: mapped.code, message: mapped.message }, duration });
  } finally {
    busy = false;
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

async function router(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;

  // Health — no auth
  if (method === 'GET' && url === '/api/health') {
    handleHealth(res);
    return;
  }

  // All other endpoints require auth
  if (!checkAuth(req)) {
    json(res, 401, {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
      duration: 0,
    });
    return;
  }

  if (method === 'POST' && url === '/api/run') return handleRun(res);
  if (method === 'POST' && url === '/api/login') return handleLogin(res);
  if (method === 'POST' && url === '/api/attend') return handleAttend(res);

  json(res, 404, {
    success: false,
    error: { code: 'NOT_FOUND', message: `${method} ${url} not found` },
    duration: 0,
  });
}

// ---------------------------------------------------------------------------
// Server bootstrap
// ---------------------------------------------------------------------------

export function startServer(): void {
  const port = config.service.port;

  const server = createServer((req, res) => {
    router(req, res).catch((err) => {
      console.error('[server] Unhandled error:', err);
      if (!res.writableEnded) {
        json(res, 500, {
          success: false,
          error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' },
          duration: 0,
        });
      }
    });
  });

  server.listen(port, () => {
    console.log(`[server] HYCU service listening on :${port}`);
    console.log('[server] Endpoints:');
    console.log('[server]   GET  /api/health  — health check (no auth)');
    console.log('[server]   POST /api/run     — full attendance cycle');
    console.log('[server]   POST /api/login   — login only');
    console.log('[server]   POST /api/attend  — attend only');
    console.log(
      `[server] Auth: ${config.service.apiKey ? 'API key required (x-api-key)' : 'OPEN (no HYCU_SERVICE_API_KEY)'}`,
    );
  });

  process.on('SIGTERM', () => {
    console.log('[server] SIGTERM received, shutting down...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('[server] SIGINT received, shutting down...');
    server.close(() => process.exit(0));
  });
}
