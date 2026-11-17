import { ACTIVE_LEAVE_STATUSES, leaveShiftCode, staffDateKey } from "./fixed-leave.ts";
import { monthDates } from "./monthly-shift.ts";

type HolidayCell = { staff_id: number; work_date: string; shift_code: string };
type Leave = { staff_id: number; leave_date: string; leave_type: string; status: string };

export type HolidayUsage = { used_current_holidays: number; used_carried_holidays: number };

export function countHolidayUsage(
  month: string,
  assignments: readonly HolidayCell[],
  leaves: readonly Leave[],
) {
  const specialLeaveDays = new Set(leaves
    .filter((leave) => ACTIVE_LEAVE_STATUSES.some((status) => status === leave.status) && leaveShiftCode(leave.leave_type) === "公")
    .map((leave) => staffDateKey(leave.staff_id, leave.leave_date)));
  const counts = new Map<number, HolidayUsage>();

  for (const { staff_id, work_date, shift_code } of assignments) {
    if (!work_date.startsWith(month + "-")) continue;
    const current = shift_code === "公" && !specialLeaveDays.has(staffDateKey(staff_id, work_date)) ? 1
      : ["A/コ", "コ/カ", "マ/コ"].includes(shift_code) ? 0.5 : 0;
    const carried = shift_code === "前" ? 1 : shift_code === "マ/コ" ? 0.5 : 0;
    if (!current && !carried) continue;
    const usage = counts.get(staff_id) ?? { used_current_holidays: 0, used_carried_holidays: 0 };
    usage.used_current_holidays += current;
    usage.used_carried_holidays += carried;
    counts.set(staff_id, usage);
  }
  return counts;
}

export function calculateHolidayGrant(month: string, nationalHolidays: ReadonlySet<string>) {
  return monthDates(month).reduce((grant, { date, day, weekday }) => {
    const special = date.endsWith("-05-01") ||
      (date.slice(5, 7) === "01" && day <= 3) ||
      (date.slice(5, 7) === "12" && day >= 29);
    if (special || nationalHolidays.has(date) || weekday === 0) return grant + 1;
    return grant + (weekday === 6 ? 0.5 : 0);
  }, 1);
}

export function calculateHolidayBalance(calculated: number, carried: number | null, usage?: HolidayUsage) {
  const currentUsed = usage?.used_current_holidays ?? 0;
  const carriedUsed = usage?.used_carried_holidays ?? 0;
  const available = carried === null ? null : calculated + carried;

  return {
    calculated_holidays: calculated,
    carried_over_holidays: carried,
    available_holidays: available,
    used_current_holidays: currentUsed,
    used_carried_holidays: carriedUsed,
    remaining_holidays: available === null ? null : available - currentUsed - carriedUsed,
  };
}
