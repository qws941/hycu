import type { LessonState } from './lms-api.js';

const KST_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function getTodayKst(): string {
  const parts = KST_FORMATTER.formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value ?? '';
  const month = parts.find((part) => part.type === 'month')?.value ?? '';
  const day = parts.find((part) => part.type === 'day')?.value ?? '';
  return `${year}${month}${day}`;
}

export function normalizeDate(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 8);
}

export function classifyLesson(
  lesson: { attended: boolean; lessonStartDt: string; lessonEndDt: string; ltDetmToDtMax: string },
  today: string,
): LessonState {
  if (lesson.attended) {
    return 'attended';
  }
  if (lesson.lessonStartDt && lesson.lessonStartDt > today) {
    return 'upcoming';
  }
  const deadline = lesson.ltDetmToDtMax || lesson.lessonEndDt;
  if (deadline && deadline < today) {
    return 'overdue';
  }
  return 'pending';
}
