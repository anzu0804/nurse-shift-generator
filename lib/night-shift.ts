import { staffDateKey } from "./fixed-leave.ts";

export const NIGHT_SHIFT_CODE = "D";

export type NightShiftStaff = {
  id: number;
  employment_status: string;
  is_active: boolean;
  can_night_shift: boolean;
  display_order: number | null;
};

type ShiftCell = {
  staff_id: number;
  work_date: string;
  shift_code: string;
};

export function getNightShiftCandidates(
  staffs: readonly NightShiftStaff[],
  date: string,
  occupied: ReadonlySet<string>,
  nightCounts: ReadonlyMap<number, number>,
  nightShiftLimit: number,
) {
  return staffs.filter((staff) =>
    staff.employment_status === "在籍中" &&
    staff.is_active === true &&
    staff.can_night_shift === true &&
    !occupied.has(staffDateKey(staff.id, date)) &&
    (nightCounts.get(staff.id) ?? 0) < nightShiftLimit,
  ).sort((a, b) =>
    (nightCounts.get(a.id) ?? 0) - (nightCounts.get(b.id) ?? 0) ||
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
}: {
  dates: readonly { date: string }[];
  staffs: readonly NightShiftStaff[];
  fixedCells: readonly ShiftCell[];
  existingAssignments: readonly ShiftCell[];
  nightShiftLimit: number;
  nightStaffCount: number;
}) {
  const month = new Set(dates.map(({ date }) => date));
  const occupied = new Set(fixedCells.map(({ staff_id, work_date }) => staffDateKey(staff_id, work_date)));
  const nightCounts = new Map<number, number>();
  const assignedByDate = new Map<string, number>();
  const existingKeys = new Set<string>();

  for (const { staff_id, work_date, shift_code } of existingAssignments) {
    if (!month.has(work_date)) continue;
    const key = staffDateKey(staff_id, work_date);
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    const conflictsWithFixedCell = occupied.has(key);
    occupied.add(key);
    if (shift_code !== NIGHT_SHIFT_CODE) continue;
    nightCounts.set(staff_id, (nightCounts.get(staff_id) ?? 0) + 1);
    if (!conflictsWithFixedCell) {
      assignedByDate.set(work_date, (assignedByDate.get(work_date) ?? 0) + 1);
    }
  }

  const assignments: ShiftCell[] = [];
  const shortages: { work_date: string; missing_count: number }[] = [];
  for (const date of month) {
    let missingCount = nightStaffCount - (assignedByDate.get(date) ?? 0);
    if (missingCount <= 0) continue;

    const candidates = getNightShiftCandidates(staffs, date, occupied, nightCounts, nightShiftLimit);
    for (const { id } of candidates) {
      const key = staffDateKey(id, date);
      if (occupied.has(key)) continue;

      occupied.add(key);
      nightCounts.set(id, (nightCounts.get(id) ?? 0) + 1);
      assignments.push({ staff_id: id, work_date: date, shift_code: NIGHT_SHIFT_CODE });
      missingCount -= 1;
      if (missingCount === 0) break;
    }

    if (missingCount > 0) shortages.push({ work_date: date, missing_count: missingCount });
  }

  return { assignments, shortages };
}
