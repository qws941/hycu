import { ROAD_BASE, LMS_BASE, YEAR, SEMESTER } from './constants';
import type { CourseProgress } from '../types';

export async function fetchToken(roadCookies: string): Promise<string> {
  const res = await fetch(`${ROAD_BASE}/pot/MainCtr/findToken.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: roadCookies,
    },
    body: 'gubun=lms',
  });
  const raw = (await res.text()).trim();

  // Token endpoint returns JSON {"token":"hex..."} — extract the hex string
  let token = raw;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.token === 'string') {
      token = parsed.token;
    }
  } catch {
    // Already plain text token — use as-is
  }

  if (!token || token.length < 10) {
    throw new Error(`유효하지 않은 토큰: ${token.substring(0, 50)}`);
  }
  return token;
}

/**
 * Fetch enrolled courses with progress from LMS API.
 * selectStdProgressRatio.do with year+semester returns combined course list + progress.
 * HAR-verified params: year, semester, userNo, progressType=C, token
 * Response fields: crsCreNm (name), progRatio (progress %), corsUrl (contains crsCreCd),
 *   totWeekCnt, declsNo
 */
export async function fetchCoursesWithProgress(
  token: string,
  userNo: string,
): Promise<CourseProgress[]> {
  const qs = new URLSearchParams({
    year: YEAR,
    semester: SEMESTER,
    userNo,
    progressType: 'C',
    token,
  });
  const url = `${LMS_BASE}/api/selectStdProgressRatio.do?${qs}`;
  const res = await fetch(url, {
    headers: { 'x-requested-with': 'XMLHttpRequest' },
  });
  const data = (await res.json()) as Record<string, unknown>;

  const returnList = Array.isArray(data.returnList)
    ? (data.returnList as Array<Record<string, unknown>>)
    : [];

  return returnList
    .map((item) => {
      // Extract crsCreCd from corsUrl: '/crs/crsHomeStd.do?crsCreCd=202610CCP06401'
      const corsUrl = String(item.corsUrl || '');
      const match = corsUrl.match(/crsCreCd=([^&]+)/);
      const crsCreCd = match ? match[1] : '';
      return {
        crsCreCd,
        name: String(item.crsCreNm || ''),
        progressRatio: Number(item.progRatio || 0),
        attendCount: 0,
        totalCount: Number(item.totWeekCnt || 0),
      };
    })
    .filter((c) => c.crsCreCd);
}
