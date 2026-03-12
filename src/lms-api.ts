import { config } from './config.js';
import {
  assertNotSessionRedirect,
  parseJsonResponse,
} from './cookies.js';
import { normalizeDate } from './date.js';

const LMS = config.urls.lms;
const USER_NO = config.userId;
const YEAR = config.semester.year;
const SEMESTER = config.semester.term;

export interface CourseInfo {
  crsCreCd: string;
  name: string;
  progressRatio: number;
  totalWeeks: number;
}

export interface LessonSchedule {
  lessonScheduleId: string;
  lessonTimeId: string;
  lessonCntsId: string;
  title: string;
  pageCount: number;
  attended: boolean;
  progressRatio: number;
  lbnTm: number;
  lessonStartDt: string;
  lessonEndDt: string;
  ltDetmToDtMax: string;
}

export type LessonState = 'attended' | 'pending' | 'overdue' | 'upcoming';

export interface CourseProgress {
  crsCreCd: string;
  name: string;
  progressRatio: number;
  attendCount: number;
  totalCount: number;
}

export async function fetchCourses(token: string): Promise<CourseInfo[]> {
  const qs = new URLSearchParams({
    progressType: 'C',
    year: YEAR,
    semester: SEMESTER,
    userNo: USER_NO,
    token,
  });

  const res = await fetch(`${LMS}/common/selectStdProgressRatio.do?${qs}`, {
    headers: {
      'x-requested-with': 'XMLHttpRequest',
      'content-type': 'application/x-www-form-urlencoded',
    },
  });

  const finalRes =
    res.status === 404
      ? await fetch(`${LMS}/api/selectStdProgressRatio.do?${qs}`, {
          headers: {
            'x-requested-with': 'XMLHttpRequest',
            'content-type': 'application/x-www-form-urlencoded',
          },
        })
      : res;

  const data = await parseJsonResponse<Record<string, unknown>>(finalRes, 'fetchCourses');
  const list = Array.isArray(data.returnList)
    ? (data.returnList as Array<Record<string, unknown>>)
    : [];

  return list
    .map((item) => {
      const corsUrl = String(item.corsUrl ?? '');
      const match = corsUrl.match(/crsCreCd=([^&]+)/);
      const progressRatio = Number(item.progRatio ?? 0);
      const totalWeeks = Number(item.totWeekCnt ?? 0);
      return {
        crsCreCd: match ? match[1] : '',
        name: String(item.crsNm ?? item.crsCreNm ?? ''),
        progressRatio,
        totalWeeks,
      };
    })
    .filter((course) => course.crsCreCd);
}

export async function fetchLessonSchedules(
  lmsCookies: string,
  crsCreCd: string,
): Promise<LessonSchedule[]> {
  const stdNo = `${crsCreCd}${USER_NO}`;
  const res = await fetch(`${LMS}/classroom/listCrsHomeLessonSchedule.do`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: lmsCookies,
    },
    body: new URLSearchParams({
      crsCreCd,
      stdNo,
      userNo: USER_NO,
    }).toString(),
    redirect: 'follow',
  });

  const finalRes =
    res.status === 404
      ? await fetch(`${LMS}/crs/listCrsHomeLessonSchedule.do`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Requested-With': 'XMLHttpRequest',
            Cookie: lmsCookies,
          },
          body: new URLSearchParams({
            crsCreCd,
            stdNo,
            userNo: USER_NO,
          }).toString(),
          redirect: 'follow',
        })
      : res;

  assertNotSessionRedirect(finalRes);
  const data = await parseJsonResponse<Record<string, unknown>>(
    finalRes,
    'fetchLessonSchedules',
  );

  const weeks = Array.isArray(data.result)
    ? (data.result as Array<Record<string, unknown>>)
    : Array.isArray(data.returnList)
      ? (data.returnList as Array<Record<string, unknown>>)
      : Array.isArray(data.list)
        ? (data.list as Array<Record<string, unknown>>)
        : Array.isArray(data)
          ? (data as Array<Record<string, unknown>>)
          : [];

  return weeks
    .map((weekObj) => {
      const listLessonTime = Array.isArray(weekObj.listLessonTime)
        ? (weekObj.listLessonTime as Array<Record<string, unknown>>)
        : [];
      const time0 = listLessonTime[0] ?? {};
      const listLessonCnts = Array.isArray(time0.listLessonCnts)
        ? (time0.listLessonCnts as Array<Record<string, unknown>>)
        : [];
      const cnts0 = listLessonCnts[0] ?? {};

      const atndYn = String(weekObj.atndYn ?? time0.atndYn ?? cnts0.atndYn ?? '');
      const title = String(
        weekObj.lessonScheduleNm ?? weekObj.title ?? cnts0.lessonCntsNm ?? '',
      );

      return {
        lessonScheduleId: String(weekObj.lessonScheduleId ?? ''),
        lessonTimeId: String(time0.lessonTimeId ?? weekObj.lessonTimeId ?? ''),
        lessonCntsId: String(cnts0.lessonCntsId ?? weekObj.lessonCntsId ?? ''),
        title,
        pageCount: Number(cnts0.cntsPageCnt ?? weekObj.pageCnt ?? 1),
        attended: atndYn === 'Y',
        progressRatio: Number(weekObj.prgrRatio ?? time0.prgrRatio ?? 0),
        lbnTm: Number(cnts0.lbnTm ?? weekObj.lbnTm ?? 30),
        lessonStartDt: normalizeDate(String(weekObj.lessonStartDt ?? time0.lessonStartDt ?? '')),
        lessonEndDt: normalizeDate(String(weekObj.lessonEndDt ?? time0.lessonEndDt ?? '')),
        ltDetmToDtMax: normalizeDate(String(weekObj.ltDetmToDtMax ?? time0.ltDetmToDtMax ?? '')),
      };
    })
    .filter(
      (lesson) =>
        lesson.lessonScheduleId && lesson.lessonTimeId && lesson.lessonCntsId,
    );
}
