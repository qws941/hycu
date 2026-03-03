import { ROAD_BASE, KV_KEYS } from './constants';
import type { SessionData } from '../types';

export async function getSession(kv: KVNamespace): Promise<SessionData | null> {
  const raw = await kv.get(KV_KEYS.session);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function saveSession(kv: KVNamespace, session: SessionData): Promise<void> {
  await kv.put(KV_KEYS.session, JSON.stringify(session));
}

export async function clearSession(kv: KVNamespace): Promise<void> {
  await kv.delete(KV_KEYS.session);
}

export async function checkSession(roadCookies: string): Promise<boolean> {
  try {
    const res = await fetch(`${ROAD_BASE}/pot/MainCtr/mainView.do`, {
      headers: { Cookie: roadCookies },
      redirect: 'manual',
    });
    const location = res.headers.get('Location') || '';
    if (res.status >= 300 && res.status < 400) {
      return !location.includes('sso') && !location.includes('Login');
    }
    return res.status === 200;
  } catch {
    return false;
  }
}
