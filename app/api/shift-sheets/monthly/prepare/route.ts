import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { FixedLeaveValidationError, prepareFixedLeaves } from "@/lib/fixed-leave";
import { readMonthlyLeaveRequests, readPages } from "@/lib/monthly-leave-requests";
import { isMonthlyShiftMonth, monthDates } from "@/lib/monthly-shift";
import { offsetShiftDate } from "@/lib/night-after";
import { assignNightShifts } from "@/lib/night-shift";

type PreparedShift = {
  fixedCells: ReturnType<typeof prepareFixedLeaves>["fixedCells"];
  nightAssignments: ReturnType<typeof assignNightShifts>["assignments"];
  nightShortages: ReturnType<typeof assignNightShifts>["shortages"];
  nightAfterFixedCells: ReturnType<typeof assignNightShifts>["nightAfterFixedCells"];
  nightAfterConflicts: ReturnType<typeof assignNightShifts>["nightAfterConflicts"];
};

function reply(body: PreparedShift | { error: string }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function POST(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!isMonthlyShiftMonth(month)) {
    return reply({ error: "対象年月をYYYY-MM形式で指定してください。" }, 400);
  }

  try {
    const supabase = await getAuthenticatedSupabase(request);
    const dates = monthDates(month);
    const firstDate = month + "-01";
    const lastDate = dates[dates.length - 1].date;
    const [year, monthNumber] = month.split("-").map(Number);
    const { data: conditions, error: conditionsError } = await supabase
      .from("shift_conditions")
      .select("default_night_shift_limit, night_staff_count, night_shift_next_day_after")
      .eq("target_year", year)
      .eq("target_month", monthNumber)
      .abortSignal(request.signal)
      .maybeSingle();
    if (conditionsError) throw conditionsError;

    // Match the conditions screen defaults for a month with no saved settings.
    const nightShiftLimit = conditions?.default_night_shift_limit ?? 4;
    const nightStaffCount = conditions?.night_staff_count ?? 0;
    const nightShiftNextDayAfter = conditions?.night_shift_next_day_after ?? true;
    if (![nightShiftLimit, nightStaffCount].every((value) => Number.isInteger(value) && value >= 0)) {
      return reply({ error: "夜勤上限と夜勤必要人数に0以上の整数を指定してください。" }, 422);
    }

    async function readAssignments(startDate: string, endDate: string) {
      const [sheetYear, sheetMonth] = startDate.split("-").map(Number);
      const { data: sheet, error } = await supabase
        .from("shift_sheets")
        .select("id")
        .eq("sheet_type", "monthly_schedule")
        .eq("target_year", sheetYear)
        .eq("target_month", sheetMonth)
        .is("week_number", null)
        .order("version", { ascending: false })
        .limit(1)
        .abortSignal(request.signal)
        .maybeSingle();
      if (error) throw error;
      if (!sheet) return [];

      return readPages((from, to) => supabase
        .from("shift_assignments")
        .select("staff_id, work_date, shift_code", { count: "exact" })
        .eq("shift_sheet_id", sheet.id)
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal));
    }

    const previousDate = nightShiftNextDayAfter ? offsetShiftDate(firstDate, -1) : undefined;
    const nextDate = nightShiftNextDayAfter ? offsetShiftDate(lastDate, 1) : undefined;
    const [leaveRequests, staffs, currentAssignments, previousAssignments, nextAssignments] = await Promise.all([
      readMonthlyLeaveRequests(supabase, firstDate, nextDate ?? lastDate, request.signal),
      nightStaffCount > 0 ? readPages((from, to) => supabase
        .from("staffs")
        .select("id, employment_status, is_active, can_night_shift, display_order", { count: "exact" })
        .eq("employment_status", "在籍中")
        .eq("is_active", true)
        .eq("can_night_shift", true)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal)) : [],
      nightShiftNextDayAfter || nightStaffCount > 0 ? readAssignments(firstDate, lastDate) : [],
      previousDate ? readAssignments(previousDate, previousDate) : [],
      nextDate ? readAssignments(nextDate, nextDate) : [],
    ]);
    const { fixedCells } = prepareFixedLeaves(nextDate ? [...dates, { date: nextDate }] : dates, leaveRequests);
    const { assignments, shortages, nightAfterFixedCells, nightAfterConflicts } = assignNightShifts({
      dates,
      staffs,
      fixedCells,
      existingAssignments: [...previousAssignments, ...currentAssignments, ...nextAssignments],
      nightShiftLimit,
      nightStaffCount,
      nightShiftNextDayAfter,
    });
    return reply({
      fixedCells: fixedCells.filter(({ work_date }) => work_date !== nextDate),
      nightAssignments: assignments,
      nightShortages: shortages,
      nightAfterFixedCells,
      nightAfterConflicts,
    });
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (error instanceof FixedLeaveValidationError) return reply({ error: error.message }, 422);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "シフト作成に必要な情報を取得する権限がありません。" }, 403);
    }
    return reply({ error: "月間シフトの生成準備ができませんでした。" }, 500);
  }
}
