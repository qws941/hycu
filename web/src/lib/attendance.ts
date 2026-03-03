import { LMS_BASE } from './constants';
import type { LessonSchedule } from '../types';

export async function fetchLessonSchedules(
  lmsCookies: string,
  crsCreCd: string,
  userNo: string,
): Promise<LessonSchedule[]> {
  const stdNo = `${crsCreCd}${userNo}`;
  const res = await fetch(`${LMS_BASE}/crs/listCrsHomeLessonSchedule.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: lmsCookies,
    },
    body: new URLSearchParams({ crsCreCd, stdNo, userNo }).toString(),
  });

  const data = (await res.json()) as Record<string, unknown>;
  const list = (data.list ?? data.result ?? (Array.isArray(data) ? data : [])) as Array<
    Record<string, unknown>
  >;

  return list.map((item) => ({
    lessonScheduleId: String(item.lessonScheduleId ?? ''),
    lessonTimeId: String(item.lessonTimeId ?? ''),
    lessonCntsId: String(item.lessonCntsId ?? ''),
    title: String(item.lessonScheduleNm ?? item.title ?? ''),
    pageCount: Number(item.pageCnt ?? 1),
    attended: item.atndYn === 'Y',
    progressRatio: Number(item.prgrRatio ?? 0),
    lbnTm: Number(item.lbnTm ?? 30),
    lessonStartDt: String(item.lessonStartDt ?? ''),
    lessonEndDt: String(item.lessonEndDt ?? ''),
    ltDetmToDtMax: String(item.ltDetmToDtMax ?? ''),
  }));
}

function nowHHMMSS(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

async function postStudyRecord(
  lmsCookies: string,
  params: URLSearchParams,
): Promise<{ ok: boolean; result: number; raw: string }> {
  const res = await fetch(`${LMS_BASE}/lesson/stdy/saveStdyRecord.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: lmsCookies,
    },
    body: params.toString(),
  });

  const text = await res.text();
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return { ok: res.ok, result: Number(json.result ?? 0), raw: text };
  } catch {
    return { ok: res.ok, result: 0, raw: text };
  }
}

export async function saveAttendanceRecord(
  lmsCookies: string,
  userNo: string,
  crsCreCd: string,
  lesson: LessonSchedule,
): Promise<{ success: boolean; message: string }> {
  const stdNo = `${crsCreCd}${userNo}`;
  const lbnTm = lesson.lbnTm || 30;
  const requiredMinutes = Math.ceil(lbnTm * 0.55);
  const playStartDttm = nowHHMMSS();

  const baseParams = {
    userNo,
    stdNo,
    crsCreCd,
    lessonScheduleId: lesson.lessonScheduleId,
    lessonCntsId: lesson.lessonCntsId,
    lessonTimeId: lesson.lessonTimeId,
    lessonStartDt: lesson.lessonStartDt,
    lessonEndDt: lesson.lessonEndDt,
    ltDetmToDtMax: lesson.ltDetmToDtMax,
    speedPlayTime: 'false',
    lbnTm: String(lbnTm),
    studyCnt: '2',
    studyStatusCd: 'STUDY',
    prgrYn: 'Y',
    studyTotalTm: String(requiredMinutes),
    studyAfterTm: '0',
    studySumTm: String(requiredMinutes),
    pageCnt: String(lesson.pageCount),
    pageStudyTm: String(requiredMinutes - 1),
    pageStudyCnt: '2',
    pageAtndYn: 'Y',
    playSpeed: '1',
    playStartDttm,
  };

  try {
    // Call 1: start — mimics initial study record (HAR-verified dual-call pattern)
    const call1Params = new URLSearchParams({
      ...baseParams,
      studySessionTm: '1',
      cntsPlayTm: '0',
      studySessionLoc: String(requiredMinutes - 1),
      pageSessionTm: '0',
      cntsRatio: '0',
      pageRatio: '8',
      saveType: 'start',
    });

    const r1 = await postStudyRecord(lmsCookies, call1Params);
    if (!r1.ok) {
      return { success: false, message: `실패: ${lesson.title} (HTTP error, call 1)` };
    }

    // 2-second delay between calls (matches HAR timing)
    await new Promise((r) => setTimeout(r, 2000));

    // Call 2: progress update — slightly advanced timing fields (HAR-verified)
    const call2Params = new URLSearchParams({
      ...baseParams,
      studySessionTm: '2',
      cntsPlayTm: '1',
      studySessionLoc: String(requiredMinutes),
      pageSessionTm: '2',
      cntsRatio: '0',
      pageRatio: '9',
      saveType: 'ing',
    });

    const r2 = await postStudyRecord(lmsCookies, call2Params);

    // result >= 1 means record saved successfully (HAR-verified: result=1 on success)
    if (r2.result >= 1) {
      return { success: true, message: `완료: ${lesson.title}` };
    }

    if (r2.ok) {
      return { success: true, message: `전송됨: ${lesson.title} (result=${r2.result})` };
    }

    return { success: false, message: `실패: ${lesson.title} (result=${r2.result})` };
  } catch (err) {
    return { success: false, message: `오류: ${lesson.title} — ${err}` };
  }
}
