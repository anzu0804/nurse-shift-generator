import { staffDateKey } from "./fixed-leave.ts";
import { offsetShiftDate } from "./night-after.ts";

type DayShiftStaff = {
  id: number;
  employment_status: string;
  is_active: boolean;
  job_type: string;
  display_order: number | null;
};

type ShiftCell = {
  staff_id: number;
  work_date: string;
  shift_code: string;
  work_amount?: number;
};

type DayShiftRequirements = {
  weekday: number;
  saturday: number;
  sunday: number;
};

const DAY_SHIFT_CODE = "A";
const dayShiftCodes = new Set([DAY_SHIFT_CODE, "A/S", "A/カ", "A/ケ", "A/コ", "A/管"]);
const workShiftCodes = new Set([...dayShiftCodes, "D", "JA", "JO"]);

function isWorkShift(cell: ShiftCell | undefined) {
  return cell !== undefined && (
    workShiftCodes.has(cell.shift_code) ||
    (cell.shift_code === "研修" && (cell.work_amount ?? 0) > 0)
  );
}

function isDayShiftStaff(staff: DayShiftStaff) {
  return staff.is_active && staff.employment_status === "在籍中" &&
    (staff.job_type === "正看護師" || staff.job_type === "補助看護師");
}

export function requiredDayShiftCount(weekday: number, requirements: DayShiftRequirements) {
  if (weekday === 6) return requirements.saturday;
  if (weekday === 0) return requirements.sunday;
  return requirements.weekday;
}

function staysWithinWorkLimit(
  staffId: number,
  date: string,
  cells: ReadonlyMap<string, ShiftCell>,
  maxConsecutiveWorkDays: number,
) {
  let workDays = 1;
  for (const direction of [-1, 1]) {
    let adjacentDate = offsetShiftDate(date, direction);
    while (adjacentDate && isWorkShift(cells.get(staffDateKey(staffId, adjacentDate)))) {
      workDays += 1;
      if (workDays > maxConsecutiveWorkDays) return false;
      adjacentDate = offsetShiftDate(adjacentDate, direction);
    }
  }

  return workDays <= maxConsecutiveWorkDays;
}

export function getDayShiftCandidates(
  staffs: readonly DayShiftStaff[],
  date: string,
  cells: ReadonlyMap<string, ShiftCell>,
  maxConsecutiveWorkDays: number,
) {
  return staffs.filter((staff) =>
    isDayShiftStaff(staff) &&
    !cells.has(staffDateKey(staff.id, date)) &&
    staysWithinWorkLimit(staff.id, date, cells, maxConsecutiveWorkDays),
  );
}

export function assignDayShifts({
  dates,
  staffs,
  existingAssignments,
  fixedCells,
  requirements,
  maxConsecutiveWorkDays,
}: {
  dates: readonly { date: string; weekday: number }[];
  staffs: readonly DayShiftStaff[];
  existingAssignments: readonly ShiftCell[];
  fixedCells: readonly ShiftCell[];
  requirements: DayShiftRequirements;
  maxConsecutiveWorkDays: number;
}) {
  const cells = new Map<string, ShiftCell>();
  for (const cell of [...existingAssignments, ...fixedCells]) {
    cells.set(staffDateKey(cell.staff_id, cell.work_date), cell);
  }

  const staffById = new Map(staffs.filter(isDayShiftStaff).map((staff) => [staff.id, staff]));
  const eligibleStaff = [...staffById.values()];
  const month = new Set(dates.map(({ date }) => date));
  const workCounts = new Map<number, number>();
  for (const cell of cells.values()) {
    if (month.has(cell.work_date) && isWorkShift(cell)) {
      workCounts.set(cell.staff_id, (workCounts.get(cell.staff_id) ?? 0) + 1);
    }
  }

  const assignments: ShiftCell[] = [];
  const shortages: { work_date: string; missing_count: number }[] = [];

  for (const { date, weekday } of [...dates].sort((a, b) => a.date.localeCompare(b.date))) {
    const required = requiredDayShiftCount(weekday, requirements);
    if (required === 0) continue;

    const existingDayStaff = eligibleStaff.filter(({ id }) =>
      dayShiftCodes.has(cells.get(staffDateKey(id, date))?.shift_code ?? ""),
    ).length;
    const needed = required - existingDayStaff;
    if (needed <= 0) continue;

    const candidates = getDayShiftCandidates(eligibleStaff, date, cells, maxConsecutiveWorkDays)
      .sort((a, b) =>
        (workCounts.get(a.id) ?? 0) - (workCounts.get(b.id) ?? 0) ||
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.id - b.id,
      );
    const selected = candidates.slice(0, needed);
    for (const { id } of selected) {
      const assignment = { staff_id: id, work_date: date, shift_code: DAY_SHIFT_CODE };
      cells.set(staffDateKey(id, date), assignment);
      assignments.push(assignment);
      workCounts.set(id, (workCounts.get(id) ?? 0) + 1);
    }

    if (selected.length < needed) {
      shortages.push({ work_date: date, missing_count: needed - selected.length });
    }
  }

  return { assignments, shortages };
}
