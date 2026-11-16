import { staffDateKey } from "./fixed-leave.ts";
import { isWorkShift, type ShiftCell } from "./shift-work.ts";

export function weekendDates(dates: readonly { date: string; weekday: number }[]) {
  return new Set(dates.filter(({ weekday }) => weekday === 0 || weekday === 6).map(({ date }) => date));
}

export function countWeekendWork(
  dates: ReadonlySet<string>,
  ...assignmentLayers: (readonly ShiftCell[])[]
) {
  const cells = new Map<string, ShiftCell>();
  for (const assignments of assignmentLayers) {
    for (const cell of assignments) {
      if (dates.has(cell.work_date)) cells.set(staffDateKey(cell.staff_id, cell.work_date), cell);
    }
  }

  const counts = new Map<number, number>();
  for (const cell of cells.values()) {
    if (isWorkShift(cell)) {
      counts.set(cell.staff_id, (counts.get(cell.staff_id) ?? 0) + 1);
    }
  }
  return counts;
}

export function getWeekendImbalance(staffIds: readonly number[], counts: ReadonlyMap<number, number>) {
  if (staffIds.length < 2) return [];

  const staff_counts = staffIds.map((staff_id) => ({ staff_id, count: counts.get(staff_id) ?? 0 }));
  let min_count = staff_counts[0].count;
  let max_count = 0;
  for (const { count } of staff_counts) {
    min_count = Math.min(min_count, count);
    max_count = Math.max(max_count, count);
  }

  // A difference of one is unavoidable when assignments do not divide evenly.
  if (max_count - min_count <= 1) return [];
  return [{ code: "W012" as const, min_count, max_count, staff_counts }];
}
