import type { getAuthenticatedSupabase } from "./authenticated-supabase";
import { readJapaneseHolidays } from "./japanese-holidays";
import { readMonthlyLeaveRequests, readPages } from "./monthly-leave-requests";
import { isMonthlyShiftMonth, monthDates } from "./monthly-shift";
import { offsetShiftDate } from "./night-after";
import { calculateHolidayBalance, calculateHolidayGrant, countHolidayUsage, type HolidayUsage } from "./public-holidays";
import { readMonthlyAssignments, readMonthlySheet } from "./saved-monthly-shift";

type Client = Awaited<ReturnType<typeof getAuthenticatedSupabase>>;
type StoredBalance = HolidayUsage & {
  staff_id: number;
  carried_over_holidays: number;
  remaining_holidays: number;
};
type Staff = { id: number; name: string; employee_no: string; is_active: boolean; employment_status: string };

export class HolidayVersionConflict extends Error {}

export type PublicHolidayRow = ReturnType<typeof calculateHolidayBalance> & {
  staff_id: number;
  employee_no: string;
  name: string;
  can_initialize: boolean;
};

export type PublicHolidays = { hasSavedSchedule: boolean; rows: PublicHolidayRow[] };

export function holidayMonth(year: unknown, month: unknown) {
  if (typeof year !== "number" || !Number.isInteger(year) ||
      typeof month !== "number" || !Number.isInteger(month)) return null;
  const date = year + "-" + String(month).padStart(2, "0");
  return isMonthlyShiftMonth(date) ? date : null;
}

function readBalances(client: Client, month: string, signal: AbortSignal) {
  const [year, number] = month.split("-").map(Number);
  return readPages((from, to) => client.from("public_holiday_balances")
    .select("staff_id, carried_over_holidays, remaining_holidays, used_current_holidays, used_carried_holidays", { count: "exact" })
    .eq("target_year", year).eq("target_month", number)
    .order("staff_id").range(from, to).abortSignal(signal)
    .overrideTypes<StoredBalance[], { merge: false }>());
}

async function readMonth(client: Client, month: string, signal: AbortSignal) {
  const [sheet, stored] = await Promise.all([
    readMonthlySheet(client, month, signal),
    readBalances(client, month, signal),
  ]);
  if (!sheet) return { month, sheet, stored, usage: new Map<number, HolidayUsage>(), assigned: new Set<number>() };

  const first = month + "-01";
  const last = monthDates(month).at(-1)!.date;
  const [assignments, leaves] = await Promise.all([
    readMonthlyAssignments(client, sheet.id, first, last, signal),
    readMonthlyLeaveRequests(client, first, last, signal),
  ]);
  return {
    month, sheet, stored,
    usage: countHolidayUsage(month, assignments, leaves),
    assigned: new Set(assignments.map((cell) => cell.staff_id)),
  };
}

export async function readPublicHolidays(
  client: Client, month: string, signal: AbortSignal, staffId?: number,
): Promise<PublicHolidays> {
  const [current, staffs] = await Promise.all([
    readMonth(client, month, signal),
    readPages((from, to) => {
      const query = client.from("staffs")
        .select("id, name, employee_no, is_active, employment_status", { count: "exact" });
      if (staffId !== undefined) query.eq("id", staffId);
      return query.order("employee_no").order("id").range(from, to).abortSignal(signal)
        .overrideTypes<Staff[], { merge: false }>();
    }),
  ]);

  // Rebuild contiguous saved months so edits also change the next month's opening balance.
  const months = [current];
  while (true) {
    const previous = offsetShiftDate(months.at(-1)!.month + "-01", -1)?.slice(0, 7);
    if (!previous || !isMonthlyShiftMonth(previous)) break;
    const data = await readMonth(client, previous, signal);
    months.push(data);
    if (!data.sheet) break;
  }

  const calendars = new Map<string, Set<string>>();
  let previousRemaining = new Map<number, number>();
  let rows: PublicHolidayRow[] = [];
  for (const data of months.toReversed()) {
    const stored = new Map(data.stored.map((row) => [row.staff_id, row]));
    if (!data.sheet && data !== current) {
      previousRemaining = new Map(data.stored.map((row) => [row.staff_id, row.remaining_holidays]));
      continue;
    }
    const year = data.month.slice(0, 4);
    const calendar = calendars.get(year) ?? await readJapaneseHolidays(year);
    calendars.set(year, calendar);
    const grant = calculateHolidayGrant(data.month, calendar);
    const nextRemaining = new Map<number, number>();
    const currentRows: PublicHolidayRow[] = [];
    for (const staff of staffs) {
      const saved = stored.get(staff.id);
      const assigned = data.assigned.has(staff.id);
      const active = staff.is_active && staff.employment_status === "在籍中";
      // An inactive staff member's existing shift or balance still belongs in the history.
      if (!saved && !assigned && !(data === current && active)) continue;
      const carry = previousRemaining.get(staff.id) ?? saved?.carried_over_holidays ?? null;
      const balance = calculateHolidayBalance(grant, carry, data.sheet ? data.usage.get(staff.id) : saved);
      if (balance.remaining_holidays !== null) nextRemaining.set(staff.id, balance.remaining_holidays);
      if (data === current) currentRows.push({
        staff_id: staff.id, name: staff.name, employee_no: staff.employee_no,
        can_initialize: active && carry === null, ...balance,
      });
    }
    previousRemaining = nextRemaining;
    if (data === current) rows = currentRows;
  }

  for (const data of months) {
    const latest = await readMonthlySheet(client, data.month, signal);
    if (latest?.id !== data.sheet?.id || latest?.version !== data.sheet?.version) {
      throw new HolidayVersionConflict();
    }
  }
  return { rows, hasSavedSchedule: current.sheet !== null };
}
