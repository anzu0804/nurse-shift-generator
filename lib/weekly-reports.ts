import { staffDateKey } from "./fixed-leave.ts";
import type { MonthlyAssignment } from "./monthly-shift.ts";
import { occurrenceDates, type Recurrence, type ReportDate } from "./report-calendar.ts";
import { shiftValidationError, type ShiftValidationResult } from "./shift-validation.ts";
import { dayShiftCodes, isWorkShift } from "./shift-work.ts";

export type ReportStaff = {
  id: number;
  name: string;
  job_type: string;
  team: string | null;
  role: string | null;
};
export type ReportEntry = Recurrence & {
  id: number;
  name: string;
  period: string | null;
  kind: "meeting" | "event";
  eventType?: string | null;
  staffIds: number[];
};
export type ReportOccurrence = Omit<ReportEntry, keyof Recurrence> & {
  date: string;
  participants: string[];
};
export type ReportConditions = {
  bath_nurse_count: number | null;
  bath_assistant_count: number | null;
};
export type WeeklyDuty = {
  staffId: number;
  name: string;
  team: string | null;
  role: string | null;
  code: string;
  requestedLeave: boolean;
  baths: { id: number; period: string | null }[];
};
export type WeeklyReports = {
  days: (ReportDate & { assignments: WeeklyDuty[]; schedule: WeeklyDuty[]; entries: ReportOccurrence[] })[];
  issues: ShiftValidationResult[];
  blocked: boolean;
};

function periodsOverlap(first: string | null, second: string | null) {
  return !["AM", "PM"].includes(first ?? "") || !["AM", "PM"].includes(second ?? "") || first === second;
}

function canTakeBath(cell: MonthlyAssignment, period: string | null) {
  return ["A", "JA"].includes(cell.shift_code) ||
    (period === "AM" && ["A/カ", "A/ケ", "A/コ", "A/管"].includes(cell.shift_code));
}

export function buildWeeklyReports({
  dates, monthly, savedDuties, staff, entries, conditions, monthlyIssues, missingMonths,
}: {
  dates: ReportDate[];
  monthly: MonthlyAssignment[];
  savedDuties: MonthlyAssignment[] | null;
  staff: ReportStaff[];
  entries: ReportEntry[];
  conditions: ReadonlyMap<string, ReportConditions>;
  monthlyIssues: ShiftValidationResult[];
  missingMonths: string[];
}): WeeklyReports {
  const issues = [...monthlyIssues];
  for (const month of missingMonths) {
    issues.push(shiftValidationError("E012", `${month} の月間業務予定表は未作成です。`));
  }
  const byStaff = new Map(staff.map((person) => [person.id, person]));
  const occurrences: ReportOccurrence[] = [];
  for (const entry of entries) {
    const matched = occurrenceDates(dates, entry);
    if (!matched) {
      issues.push(shiftValidationError("E013", `「${entry.name}」の繰り返し条件を確認してください。`));
      continue;
    }
    for (const { date } of matched) {
      occurrences.push({
        id: entry.id, name: entry.name, kind: entry.kind, eventType: entry.eventType,
        date, period: entry.period, staffIds: entry.staffIds,
        participants: entry.staffIds.flatMap((id) => {
          const person = byStaff.get(id);
          return person ? [person.name] : [];
        }),
      });
    }
  }

  const blocked = issues.some(({ severity }) => severity === "error");
  const bathCounts = new Map<string, number>();
  const savedByCell = new Map(savedDuties?.map((cell) => [staffDateKey(cell.staff_id, cell.work_date), cell]));
  const days = dates.map((day) => {
    const daily = monthly.filter((cell) => cell.work_date === day.date);
    const dailyByStaff = new Map(daily.map((cell) => [cell.staff_id, cell]));
    const dayEntries = occurrences.filter((entry) => entry.date === day.date);
    const work: WeeklyDuty[] = [];
    if (!blocked) {
      for (const cell of daily) {
        if (!isWorkShift(cell) && cell.shift_code !== "A/管") continue;
        const person = byStaff.get(cell.staff_id);
        const staffRole = person?.role ?? null;
        const saved = savedByCell.get(staffDateKey(cell.staff_id, day.date));
        const team = saved ? saved.team_assignment : cell.team_assignment ?? person?.team ?? null;
        const role = saved ? saved.assignment_role : cell.assignment_role ?? (
          cell.shift_code === "A/S" ? "日責" :
          cell.shift_code === "JA" ? "看護助手日勤" :
          cell.shift_code === "JO" ? "看護助手遅番" :
          dayShiftCodes.has(cell.shift_code) && (staffRole === "主任" || staffRole === "リーダー") ? staffRole : null
        );
        work.push({
          name: cell.staff?.name ?? person?.name ?? `スタッフ #${cell.staff_id}`,
          staffId: cell.staff_id, code: cell.shift_code, requestedLeave: cell.requestedLeave,
          team, role, baths: [],
        });
      }

      if (!savedDuties) {
        // Staff marked as free cover the smaller team for the same shift.
        for (const duty of work.filter(({ team, code }) => team === "フリー" && (code === "D" || dayShiftCodes.has(code)))) {
          const coverage = work.filter(({ code }) => duty.code === "D" ? code === "D" : dayShiftCodes.has(code));
          const a = coverage.filter(({ team }) => team === "A").length;
          const b = coverage.filter(({ team }) => team === "B").length;
          duty.team = a <= b ? "A" : "B";
          duty.role ??= "フリー";
        }
      }

      const month = day.date.slice(0, 7);
      const limits = conditions.get(month);
      for (const bath of dayEntries.filter(({ eventType }) => eventType === "入浴日")) {
        if (!["AM", "PM", "終日"].includes(bath.period ?? "")) {
          issues.push(shiftValidationError("E013", `「${bath.name}」の時間帯を確認してください。`, { work_date: day.date }));
          continue;
        }
        for (const [job, required] of [["正看護師", limits?.bath_nurse_count ?? 1], ["補助看護師", limits?.bath_assistant_count ?? 2]] as const) {
          const countKey = (duty: WeeklyDuty) => `${month}:${duty.staffId}`;
          const candidates = work.filter((duty) => {
            const cell = dailyByStaff.get(duty.staffId)!;
            return byStaff.get(duty.staffId)?.job_type === job && canTakeBath(cell, bath.period) &&
              (!duty.role || duty.role === "入浴担当" || duty.role === "フリー") &&
              (!savedDuties || duty.role === "入浴担当") &&
              !duty.baths.some(({ period }) => periodsOverlap(period, bath.period)) &&
              !dayEntries.some((entry) => entry.kind === "meeting" && entry.staffIds.includes(duty.staffId) &&
                periodsOverlap(entry.period, bath.period));
          }).sort((a, b) => Number(b.role === "入浴担当") - Number(a.role === "入浴担当") ||
            (bathCounts.get(countKey(a)) ?? 0) - (bathCounts.get(countKey(b)) ?? 0) || a.staffId - b.staffId);
          for (const duty of candidates.slice(0, required)) {
            duty.baths.push({ id: bath.id, period: bath.period });
            bathCounts.set(countKey(duty), (bathCounts.get(countKey(duty)) ?? 0) + 1);
          }
          if (candidates.length < required) {
            issues.push(shiftValidationError("E009", `「${bath.name}」の${job}が${required - candidates.length}人不足しています。`, { work_date: day.date }));
          }
        }
      }

      for (const duty of work) {
        const meetings = dayEntries.filter((entry) => entry.kind === "meeting" && entry.staffIds.includes(duty.staffId));
        if (meetings.some((entry, index) => meetings.slice(index + 1).some((other) => periodsOverlap(entry.period, other.period)))) {
          issues.push(shiftValidationError("E008", `${duty.name}の会議時間帯が重複しています。`, { work_date: day.date, staff_id: duty.staffId }));
        }
      }
    }

    const dutyByStaff = new Map(work.map((duty) => [duty.staffId, duty]));
    const schedule = daily.map((cell) => dutyByStaff.get(cell.staff_id) ?? {
      staffId: cell.staff_id, name: cell.staff?.name ?? `スタッフ #${cell.staff_id}`, team: null,
      role: null, code: cell.shift_code, requestedLeave: cell.requestedLeave, baths: [],
    });
    return { ...day, assignments: work, schedule, entries: dayEntries };
  });
  return { days, issues, blocked: issues.some(({ severity }) => severity === "error") };
}
