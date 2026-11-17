import { getConsecutiveWorkWarnings, isDayShiftStaff, requiredDayShiftCount } from "./day-shift.ts";
import { ACTIVE_LEAVE_STATUSES, leaveShiftCode, staffDateKey } from "./fixed-leave.ts";
import { manualShiftAmounts, type EditableShift } from "./manual-shift.ts";
import { getNgPairViolations, indexNgPairs, type NgPair } from "./ng-pairs.ts";
import { NIGHT_AFTER_CODE, offsetShiftDate } from "./night-after.ts";
import { isNightShiftStaff, type NightShiftStaff } from "./night-shift.ts";
import { monthlyGenerationChecks, shiftValidationError, type ShiftValidationResult } from "./shift-validation.ts";
import { dayShiftCodes, isWorkShift, type ShiftCell } from "./shift-work.ts";
import { countWeekendWork, getWeekendImbalance, weekendDates } from "./weekend-shift.ts";

export type SavedShiftStaff = NightShiftStaff & {
  job_type: string;
  team: string | null;
  role: string | null;
};

export type SavedShiftConditions = {
  weekday_day_staff_count: number | null;
  saturday_day_staff_count: number | null;
  sunday_day_staff_count: number | null;
  night_staff_count: number | null;
  night_shift_next_day_after: boolean | null;
  default_night_shift_limit: number | null;
  max_consecutive_work_days: number | null;
  balance_weekend_shifts: boolean | null;
  free_day_staff_count?: number | null;
  free_night_staff_count?: number | null;
  assistant_day_staff_count?: number | null;
  assistant_late_staff_count?: number | null;
  bath_nurse_count?: number | null;
  bath_assistant_count?: number | null;
};

type SavedCell = ShiftCell & EditableShift;
type BathEvent = { event_date: string; recurrence_type: string | null; recurrence_rule: string | null };
type HolidayBalance = { staff_id: number; available_holidays: number };
type Leave = { staff_id: number; leave_date: string; leave_type: string; status: string };

function isNight(code: string | undefined) {
  return code === "D" || code === "A/管";
}

function bathSchedule(dates: readonly { date: string; weekday: number }[], events: readonly BathEvent[]) {
  const bathDates = new Set<string>();
  const issues: ShiftValidationResult[] = [];
  for (const event of events) {
    if (!event.recurrence_type || event.recurrence_type === "なし") {
      if (dates.some(({ date }) => date === event.event_date)) bathDates.add(event.event_date);
      continue;
    }
    const rule = event.recurrence_rule?.trim() ?? "";
    const weekly = event.recurrence_type === "毎週" && /^(?:毎週)?([日月火水木金土])曜日?$/.exec(rule);
    const monthly = event.recurrence_type === "毎月" && /^(?:毎月)?第([1-5])([日月火水木金土])曜日?$/.exec(rule);
    if (!weekly && !monthly) {
      issues.push(shiftValidationError("E013", `${event.event_date}の入浴日の繰り返し条件を確認してください。`));
      continue;
    }
    const weekdayIndex = "日月火水木金土".indexOf(weekly ? weekly[1] : monthly ? monthly[2] : "");
    for (const { date, weekday } of dates) {
      if (date >= event.event_date && weekday === weekdayIndex &&
        (!monthly || Math.ceil(Number(date.slice(-2)) / 7) === Number(monthly[1]))) bathDates.add(date);
    }
  }
  return { bathDates, issues };
}

export function validateSavedShift({
  dates, assignments, adjacent, staffs, leaves, ngPairs, conditions, bathEvents = [], balances = [],
}: {
  dates: readonly { date: string; weekday: number }[];
  assignments: readonly SavedCell[];
  adjacent: readonly ShiftCell[];
  staffs: readonly SavedShiftStaff[];
  leaves: readonly Leave[];
  ngPairs: readonly NgPair[];
  conditions: SavedShiftConditions | null;
  bathEvents?: readonly BathEvent[];
  balances?: readonly HolidayBalance[];
}): ShiftValidationResult[] {
  const { bathDates, issues } = bathSchedule(dates, bathEvents);
  const cells = new Map([...adjacent, ...assignments].map((cell) =>
    [staffDateKey(cell.staff_id, cell.work_date), cell.shift_code],
  ));
  const month = new Set(dates.map(({ date }) => date));
  const staffById = new Map(staffs.map((staff) => [staff.id, staff]));
  const days = new Map<string, SavedCell[]>();
  const nightCounts = new Map<number, number>();
  const holidayCounts = new Map<number, number>();

  for (const leave of leaves) {
    if (!ACTIVE_LEAVE_STATUSES.some((status) => status === leave.status)) continue;
    const expected = leaveShiftCode(leave.leave_type);
    if (!expected || cells.get(staffDateKey(leave.staff_id, leave.leave_date)) !== expected) {
      issues.push(shiftValidationError("E001", `希望休（${leave.leave_type}）が反映されていません。`, {
        staff_id: leave.staff_id, work_date: leave.leave_date,
      }));
    }
  }

  for (const cell of assignments) {
    const { staff_id, work_date, shift_code, work_amount } = cell;
    const staff = staffById.get(staff_id);
    const location = { staff_id, work_date };
    const day = days.get(work_date) ?? [];
    day.push(cell);
    days.set(work_date, day);
    if (isWorkShift(cell) && (!staff?.is_active || staff.employment_status !== "在籍中")) {
      issues.push(shiftValidationError("STAFF_INACTIVE", "在籍中の有効なスタッフに勤務を割り当ててください。", location));
    }
    if (isNight(shift_code)) {
      if (!staff || !isNightShiftStaff(staff)) {
        issues.push(shiftValidationError("E002", "夜勤可能なスタッフに夜勤を割り当ててください。", location));
      }
      nightCounts.set(staff_id, (nightCounts.get(staff_id) ?? 0) + 1);
    }
    if (["A/S", "A/管", "ア/管", "研修"].includes(shift_code) && staff?.role !== "師長") {
      issues.push(shiftValidationError("MANAGER_SHIFT", "師長専用の勤務記号が使われています。", location));
    }
    const holidays = ["公", "前", "マ/コ"].includes(shift_code) ? 1 : ["A/コ", "コ/カ"].includes(shift_code) ? 0.5 : 0;
    if (holidays) holidayCounts.set(staff_id, (holidayCounts.get(staff_id) ?? 0) + holidays);
    const amount = manualShiftAmounts.get(shift_code);
    if (typeof amount === "number" && amount !== work_amount) {
      issues.push({ ...shiftValidationError("WORK_AMOUNT", `「${shift_code}」の勤務実績は${amount}です。`, location), severity: "warning" });
    }
  }

  for (const { staff_id, available_holidays } of balances) {
    const used = holidayCounts.get(staff_id) ?? 0;
    if (used !== available_holidays) {
      issues.push({
        severity: "warning", validation_code: used < available_holidays ? "W003" : "HOLIDAY_LIMIT", staff_id,
        message: `公休・前公の割当は${used}日、利用可能公休は${available_holidays}日です。`,
      });
    }
  }

  if (conditions?.night_shift_next_day_after ?? true) {
    for (const { staff_id, work_date, shift_code } of [...adjacent, ...assignments]) {
      if (!isNight(shift_code)) continue;
      const next = offsetShiftDate(work_date, 1);
      if (!next || (!month.has(work_date) && !month.has(next))) continue;
      const code = cells.get(staffDateKey(staff_id, next));
      if (code !== NIGHT_AFTER_CODE && code !== "ア/管") {
        issues.push(shiftValidationError("E007", `${work_date}の夜勤の翌日に夜勤明けがありません。`, { staff_id, work_date: next }));
      }
    }
  }

  const nightShortages = [];
  const dayShortages = [];
  const dayTeamShortages = [];
  const dayLeadershipShortages = [];
  const warnings: Parameters<typeof monthlyGenerationChecks>[0]["warnings"] = [];
  if (!conditions) {
    issues.push({ ...shiftValidationError("E011", "対象月の勤務条件が未登録のため、必要人数と上限を確認できません。"), severity: "warning" });
  } else {
    const requirements = {
      weekday: conditions.weekday_day_staff_count ?? 0,
      saturday: conditions.saturday_day_staff_count ?? 0,
      sunday: conditions.sunday_day_staff_count ?? 0,
    };
    for (const { date, weekday } of dates) {
      const daily = days.get(date) ?? [];
      const dayStaff = daily.flatMap((cell) => {
        const staff = staffById.get(cell.staff_id);
        return staff && isDayShiftStaff(staff) && dayShiftCodes.has(cell.shift_code)
          ? [{ team: cell.team_assignment ?? staff.team, role: staff.role }]
          : [];
      });
      const nightStaff = daily.filter((cell) => {
        const staff = staffById.get(cell.staff_id);
        return staff && isNightShiftStaff(staff) && isNight(cell.shift_code);
      });
      const active = daily.filter((cell) => {
        const staff = staffById.get(cell.staff_id);
        return staff?.is_active && staff.employment_status === "在籍中";
      });
      const dayCoverage = active.filter((cell) => dayShiftCodes.has(cell.shift_code));
      if (!dayCoverage.some((cell) => {
        const role = staffById.get(cell.staff_id)?.role;
        return role === "師長" || role === "主任" || cell.assignment_role === "日責";
      })) {
        issues.push(shiftValidationError("E005", "日勤に師長または代理者がいません。", { work_date: date }));
      }
      const requirementsByRole = [
        ["フリー日勤", dayStaff.filter((staff) => staff.team === "フリー").length, conditions.free_day_staff_count ?? 0],
        ["フリー夜勤", nightStaff.filter((cell) => cell.team_assignment === "フリー").length, conditions.free_night_staff_count ?? 0],
        ["看護助手日勤", active.filter((cell) => cell.shift_code === "JA" && staffById.get(cell.staff_id)?.job_type === "看護助手").length, conditions.assistant_day_staff_count ?? 0],
        ["看護助手遅番", active.filter((cell) => cell.shift_code === "JO" && staffById.get(cell.staff_id)?.job_type === "看護助手").length, conditions.assistant_late_staff_count ?? 0],
      ] as const;
      for (const [label, actual, minimum] of requirementsByRole) {
        if (actual < minimum) issues.push(shiftValidationError("E004", `${label}が${minimum - actual}人不足しています。`, { work_date: date }));
      }
      if (bathDates.has(date)) {
        const bathStaff = dayCoverage.filter((cell) => cell.assignment_role === "入浴担当");
        for (const [job, minimum] of [["正看護師", conditions.bath_nurse_count ?? 1], ["補助看護師", conditions.bath_assistant_count ?? 2]] as const) {
          const missing = minimum - bathStaff.filter((cell) => staffById.get(cell.staff_id)?.job_type === job).length;
          if (missing > 0) issues.push(shiftValidationError("E009", `入浴担当の${job}が${missing}人不足しています。`, { work_date: date }));
        }
      }
      const required = requiredDayShiftCount(weekday, requirements);
      if (dayStaff.length < required) dayShortages.push({ work_date: date, missing_count: required - dayStaff.length });
      const requiredNights = conditions.night_staff_count ?? 0;
      if (nightStaff.length < requiredNights) nightShortages.push({ work_date: date, missing_count: requiredNights - nightStaff.length });
      for (const team of ["A", "B"] as const) {
        const members = dayStaff.filter((staff) => staff.team === team);
        const missing = Math.floor(required / 2) - members.length;
        if (missing > 0) dayTeamShortages.push({ work_date: date, team, missing_count: missing });
        if (!members.some(({ role }) => role === "主任" || role === "リーダー")) {
          dayLeadershipShortages.push({ work_date: date, team, missing_count: 1 });
        }
      }
    }
    const limit = conditions.default_night_shift_limit ?? 4;
    for (const [staff_id, count] of nightCounts) {
      if (count > limit) warnings.push({ code: "W001", staff_id, count, limit });
    }
    warnings.push(...getConsecutiveWorkWarnings(dates, [adjacent, assignments], conditions.max_consecutive_work_days ?? 5));
    if (conditions.balance_weekend_shifts ?? true) {
      warnings.push(...getWeekendImbalance(
        staffs.filter((staff) => isDayShiftStaff(staff) || isNightShiftStaff(staff)).map(({ id }) => id),
        countWeekendWork(weekendDates(dates), assignments),
      ));
    }
  }

  const partners = indexNgPairs(ngPairs);
  const ngPairViolations = [
    ...getNgPairViolations(assignments.filter((cell) => !isNight(cell.shift_code) || cell.shift_code === "A/管"), partners),
    ...getNgPairViolations(assignments.filter((cell) => isNight(cell.shift_code)).map((cell) => ({
      ...cell, shift_code: "D",
    })), partners),
  ];

  return [...issues, ...monthlyGenerationChecks({
    nightShortages, dayShortages, dayTeamShortages, dayLeadershipShortages,
    nightAfterConflicts: [], ngPairViolations, warnings,
  })];
}
