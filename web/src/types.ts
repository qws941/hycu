export interface Env {
  HYCU_KV: KVNamespace;
  API_KEY: string;
  HYCU_USER_ID: string;
  ASSETS: Fetcher;
}

export type AppEnv = { Bindings: Env };

export interface SessionData {
  roadCookies: string;
  lmsCookies: string;
  savedAt: string;
}

export interface CourseProgress {
  crsCreCd: string;
  name: string;
  progressRatio: number;
  attendCount: number;
  totalCount: number;
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

export interface AttendResult {
  crsCreCd: string;
  courseName: string;
  lessonTitle: string;
  success: boolean;
  message: string;
}

export interface DashboardState {
  courses: CourseProgress[];
  lastSync: string;
  lastLogin: string | null;
  lastAttend: string | null;
  stats: {
    totalCourses: number;
    completedCourses: number;
    overallProgress: number;
  };
}

export interface RunEvent {
  timestamp: string;
  action: string;
  message: string;
  success: boolean;
}

export interface SyncPayload {
  action: 'status' | 'attend' | 'login';
  timestamp: string;
  courses?: CourseProgress[];
  message?: string;
  success?: boolean;
}
