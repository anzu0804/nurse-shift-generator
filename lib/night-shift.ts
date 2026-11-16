import { staffDateKey } from "./fixed-leave.ts";

import { checkNightAfter, NIGHT_AFTER_CODE, offsetShiftDate } from "./night-after.ts";

import { NIGHT_SHIFT_CODE, type ShiftCell } from "./shift-work.ts";
import { countWeekendWork } from "./weekend-shift.ts";

export { NIGHT_SHIFT_CODE } from "./shift-work.ts";

export type NightShiftStaff = {
  id: number;
  employment_status: string;
  is_active: boolean;
  can_night_shift: boolean;
  display_order: number | null;
};

export function isNightShiftStaff(staff: NightShiftStaff) {
  return staff.employment_status === "在籍中" && staff.is_active === true && staff.can_night_shift === true;
}

export function getNightShiftCandidates(
  staffs: readonly NightShiftStaff[],
  date: string,
  occupied: ReadonlySet<string>,
  nightCounts: ReadonlyMap<number, number>,
  nightShiftLimit: number,
  weekendCounts?: ReadonlyMap<number, number>,
) {
  return staffs.filter((staff) =>
    isNightShiftStaff(staff) &&
    !occupied.has(staffDateKey(staff.id, date)) &&
    (nightCounts.get(staff.id) ?? 0) < nightShiftLimit,
  ).sort((a, b) =>
    (nightCounts.get(a.id) ?? 0) - (nightCounts.get(b.id) ?? 0) ||
    ((weekendCounts?.get(a.id) ?? 0) - (weekendCounts?.get(b.id) ?? 0)) ||
    (a.display_order ?? 0) - (b.display_order ?? 0) ||
    a.id - b.id,
  );
}

export function assignNightShifts({
  dates,
  staffs,
  fixedCells,
  existingAssignments,
  nightShiftLimit,
  nightStaffCount,
  nightShiftNextDayAfter = false,
  weekends = new Set<string>(),
}: {
  dates: readonly { date: string }[];
  staffs: readonly NightShiftStaff[];
  fixedCells: readonly ShiftCell[];
  existingAssignments: readonly ShiftCell[];
  nightShiftLimit: number;
  nightStaffCount: number;
  nightShiftNextDayAfter?: boolean;
  weekends?: ReadonlySet<string>;
}) {
  const month = new Set(dates.map(({ date }) => date).sort());
  const firstDate = month.values().next().value;
  const previousDate = firstDate && offsetShiftDate(firstDate, -1);
  const shiftCodes = new Map<string, string>();
  const existingNights = new Map<string, ShiftCell>();
  const nightCounts = new Map<number, number>();
  const assignedByDate = new Map<string, number>();

  for (const assignment of existingAssignments) {
    const { staff_id, work_date, shift_code } = assignment;
    const key = staffDateKey(staff_id, work_date);
    // Preserve a conflict even when an existing 明 also appears for the same cell.
    const currentCode = shiftCodes.get(key);
    if (currentCode === undefined || currentCode === NIGHT_AFTER_CODE) {
      shiftCodes.set(key, shift_code);
    }
    if (shift_code === NIGHT_SHIFT_CODE) existingNights.set(key, assignment);
  }
  const fixedKeys = new Set<string>();
  for (const { staff_id, work_date, shift_code } of fixedCells) {
    const key = staffDateKey(staff_id, work_date);
    fixedKeys.add(key);
    shiftCodes.set(key, shift_code);
  }

  const occupied = new Set(shiftCodes.keys());
  const nightAfterFixedCells: ShiftCell[] = [];
  const nightAfterConflicts: Extract<ReturnType<typeof checkNightAfter>, { kind: "conflict" }>["issue"][] = [];

  function fixNightAfter(result: ReturnType<typeof checkNightAfter>) {
    if (result.kind === "conflict") nightAfterConflicts.push(result.issue);
    if (result.kind !== "available") return;
    occupied.add(result.key);
    shiftCodes.set(result.key, NIGHT_AFTER_CODE);
    nightAfterFixedCells.push(result.cell);
  }

  for (const [key, { staff_id, work_date }] of existingNights) {
    if (fixedKeys.has(key)) continue;
    if (month.has(work_date)) {
      nightCounts.set(staff_id, (nightCounts.get(staff_id) ?? 0) + 1);
      if (shiftCodes.get(key) === NIGHT_SHIFT_CODE) {
        assignedByDate.set(work_date, (assignedByDate.get(work_date) ?? 0) + 1);
      }
    }
    if (nightShiftNextDayAfter && (month.has(work_date) || work_date === previousDate)) {
      fixNightAfter(checkNightAfter(staff_id, work_date, shiftCodes));
    }
  }

  const weekendCounts = weekends.size > 0 ? countWeekendWork(weekends, existingAssignments, fixedCells, nightAfterFixedCells) : undefined;
  const assignments: ShiftCell[] = [];
  const shortages: { work_date: string; missing_count: number }[] = [];
  for (const date of month) {
    let missingCount = nightStaffCount - (assignedByDate.get(date) ?? 0);
    if (missingCount <= 0) continue;

    const balanceToday = weekends.has(date) ? weekendCounts : undefined;
    const candidates = getNightShiftCandidates(staffs, date, occupied, nightCounts, nightShiftLimit, balanceToday);
    for (const { id } of candidates) {
      const key = staffDateKey(id, date);
      if (occupied.has(key)) continue;

      const nightAfter = nightShiftNextDayAfter ? checkNightAfter(id, date, shiftCodes) : undefined;
      if (nightAfter?.kind === "conflict" || nightAfter?.kind === "outside-calendar") continue;

      occupied.add(key);
      shiftCodes.set(key, NIGHT_SHIFT_CODE);
      if (nightAfter) fixNightAfter(nightAfter);
      nightCounts.set(id, (nightCounts.get(id) ?? 0) + 1);
      if (balanceToday) balanceToday.set(id, (balanceToday.get(id) ?? 0) + 1);
      assignments.push({ staff_id: id, work_date: date, shift_code: NIGHT_SHIFT_CODE });
      missingCount -= 1;
      if (missingCount === 0) break;
    }

    if (missingCount > 0) shortages.push({ work_date: date, missing_count: missingCount });
  }

  const nightLimitWarnings = [...nightCounts]
    .filter(([, count]) => count > nightShiftLimit)
    .map(([staff_id, count]) => ({ code: "W001" as const, staff_id, count, limit: nightShiftLimit }));

  return { assignments, shortages, nightAfterFixedCells, nightAfterConflicts, nightLimitWarnings };
}
