import { offsetShiftDate } from "./night-after.ts";

export const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
export type ReportDate = { date: string; weekday: number };

export function reportWeek(value: string): ReportDate[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 100) return [];
  const parsed = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return [];
  const sinceMonday = (parsed.getUTCDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, index) => ({
    date: offsetShiftDate(value, index - sinceMonday),
    weekday: (index + 1) % 7,
  }));
  return week.every((day): day is ReportDate => !!day.date && Number(day.date.slice(0, 4)) >= 100)
    ? week : [];
}

export type Recurrence = {
  date: string | null;
  recurrence_type: string | null;
  recurrence_rule: string | null;
};

// null means the registered condition cannot be interpreted.
export function occurrenceDates(dates: readonly ReportDate[], entry: Recurrence) {
  if (!entry.recurrence_type || entry.recurrence_type === "なし") {
    return dates.filter(({ date }) => date === entry.date);
  }
  const rule = entry.recurrence_rule?.trim() ?? "";
  const weekly = entry.recurrence_type === "毎週" && /^(?:毎週)?([日月火水木金土])曜日?$/.exec(rule);
  const ordinal = entry.recurrence_type === "毎月" && /^(?:毎月)?第([1-5])([日月火水木金土])曜日?$/.exec(rule);
  const monthDay = entry.recurrence_type === "毎月" && /^(?:毎月)?([1-9]|[12]\d|3[01])日$/.exec(rule);
  if (!weekly && !ordinal && !monthDay) return null;
  const weekdayIndex = weekdays.indexOf(weekly ? weekly[1] : ordinal ? ordinal[2] : "");
  return dates.filter(({ date, weekday }) => {
    if (entry.date && date < entry.date) return false;
    const day = Number(date.slice(-2));
    if (monthDay) return day === Number(monthDay[1]);
    return weekday === weekdayIndex && (!ordinal || Math.ceil(day / 7) === Number(ordinal[1]));
  });
}
