import { config } from './config.js';
import type { CourseProgress } from './lms-api.js';

/**
 * Sync module — pushes CLI run results to CF Pages dashboard.
 * Called after login, attend, and status commands.
 */

interface SyncPayload {
  action: 'status' | 'attend' | 'login';
  timestamp: string;
  courses?: CourseProgress[];
  message?: string;
  success?: boolean;
}

const DASHBOARD_URL = config.dashboard.url;
const API_KEY = config.dashboard.apiKey;

export async function syncToDashboard(payload: SyncPayload): Promise<void> {
  const url = `${DASHBOARD_URL}/api/sync`;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (API_KEY) {
      headers['Authorization'] = `Bearer ${API_KEY}`;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`[sync] Dashboard sync failed: ${res.status} ${res.statusText}`);
      return;
    }

    console.log(`[sync] Dashboard updated (${payload.action})`);
  } catch (err) {
    // Non-fatal — dashboard sync is best-effort
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[sync] Dashboard unreachable: ${msg}`);
  }
}
