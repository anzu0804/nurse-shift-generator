import type { getAuthenticatedSupabase } from "./authenticated-supabase";
import { leaveShiftCode, staffDateKey } from "./fixed-leave";
import { readMonthlyLeaveRequests, readPages } from "./monthly-leave-requests";
import { monthDates, type MonthlyAssignment, type MonthlyShift } from "./monthly-shift";
import type { ShiftValidationResult } from "./shift-validation";

type Client = Awaited<ReturnType<typeof getAuthenticatedSupabase>>;

export async function readMonthlySheet(client: Client, month: string, signal: AbortSignal) {
  const [year, monthNumber] = month.split("-").map(Number);
  const { data, error } = await client.from("shift_sheets")
    .select("id, status, version")
    .eq("sheet_type", "monthly_schedule")
    .eq("target_year", year)
    .eq("target_month", monthNumber)
    .is("week_number", null)
    .order("version", { ascending: false })
    .limit(1)
    .abortSignal(signal)
    .maybeSingle()
    .overrideTypes<NonNullable<MonthlyShift["sheet"]>, { merge: false }>();
  if (error) throw error;
  return data;
}

export function readMonthlyAssignments(client: Client, sheetId: number, fromDate: string, toDate: string, signal: AbortSignal) {
  return readPages((from, to) => client.from("shift_assignments")
    .select("id, staff_id, work_date, shift_code, team_assignment, assignment_role, work_amount, is_manual_edit, note, staff:staffs(name, employee_no, display_order)", { count: "exact" })
    .eq("shift_sheet_id", sheetId)
    .gte("work_date", fromDate)
    .lte("work_date", toDate)
    .order("id")
    .range(from, to)
    .abortSignal(signal)
    .overrideTypes<Omit<MonthlyAssignment, "requestedLeave">[], { merge: false }>());
}

export async function readSavedMonthlyShift(client: Client, month: string, signal: AbortSignal): Promise<MonthlyShift | null> {
  const sheet = await readMonthlySheet(client, month, signal);
  if (!sheet) return { sheet: null, assignments: [], validationResults: [] };

  const firstDate = month + "-01";
  const lastDate = monthDates(month).at(-1)!.date;
  const [assignments, leaves, validationResults] = await Promise.all([
    readMonthlyAssignments(client, sheet.id, firstDate, lastDate, signal),
    readMonthlyLeaveRequests(client, firstDate, lastDate, signal),
    readPages((from, to) => client.from("shift_validation_results")
      .select("staff_id, work_date, severity, validation_code, message", { count: "exact" })
      .eq("shift_sheet_id", sheet.id)
      .eq("is_resolved", false)
      .in("severity", ["error", "warning"])
      .order("id")
      .range(from, to)
      .abortSignal(signal)
      .overrideTypes<ShiftValidationResult[], { merge: false }>()),
  ]);

  // Every edit increments the version. Avoid combining pages from two revisions.
  const latest = await readMonthlySheet(client, month, signal);
  if (!latest || latest.id !== sheet.id || latest.version !== sheet.version) return null;

  const leavesByCell = new Map(leaves.map((leave) => [
    staffDateKey(leave.staff_id, leave.leave_date), leaveShiftCode(leave.leave_type),
  ]));
  return {
    sheet,
    assignments: assignments.map((cell) => ({
      ...cell,
      requestedLeave: leavesByCell.get(staffDateKey(cell.staff_id, cell.work_date)) === cell.shift_code,
    })),
    validationResults,
  };
}
