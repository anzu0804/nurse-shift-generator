import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { FixedLeaveValidationError, prepareFixedLeaves } from "@/lib/fixed-leave";
import { readMonthlyLeaveRequests, readPages } from "@/lib/monthly-leave-requests";
import { isMonthlyShiftMonth, monthDates } from "@/lib/monthly-shift";
import { assignNightShifts } from "@/lib/night-shift";

type PreparedShift = {
  fixedCells: ReturnType<typeof prepareFixedLeaves>["fixedCells"];
  nightAssignments: ReturnType<typeof assignNightShifts>["assignments"];
  nightShortages: ReturnType<typeof assignNightShifts>["shortages"];
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
    const { fixedCells } = prepareFixedLeaves(
      dates,
      await readMonthlyLeaveRequests(supabase, firstDate, lastDate, request.signal),
    );

    const { data: conditions, error: conditionsError } = await supabase
      .from("shift_conditions")
      .select("default_night_shift_limit, night_staff_count")
      .eq("target_year", year)
      .eq("target_month", monthNumber)
      .abortSignal(request.signal)
      .maybeSingle();
    if (conditionsError) throw conditionsError;

    // Match the conditions screen defaults for a month with no saved settings.
    const nightShiftLimit = conditions?.default_night_shift_limit ?? 4;
    const nightStaffCount = conditions?.night_staff_count ?? 0;
    if (![nightShiftLimit, nightStaffCount].every((value) => Number.isInteger(value) && value >= 0)) {
      return reply({ error: "夜勤上限と夜勤必要人数に0以上の整数を指定してください。" }, 422);
    }
    if (nightStaffCount === 0) {
      return reply({ fixedCells, nightAssignments: [], nightShortages: [] });
    }

    const [staffs, { data: sheet, error: sheetError }] = await Promise.all([
      readPages((from, to) => supabase
        .from("staffs")
        .select("id, employment_status, is_active, can_night_shift, display_order", { count: "exact" })
        .eq("employment_status", "在籍中")
        .eq("is_active", true)
        .eq("can_night_shift", true)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal)),
      supabase
        .from("shift_sheets")
        .select("id")
        .eq("sheet_type", "monthly_schedule")
        .eq("target_year", year)
        .eq("target_month", monthNumber)
        .is("week_number", null)
        .order("version", { ascending: false })
        .limit(1)
        .abortSignal(request.signal)
        .maybeSingle(),
    ]);
    if (sheetError) throw sheetError;

    const existingAssignments = sheet ? await readPages((from, to) => supabase
      .from("shift_assignments")
      .select("staff_id, work_date, shift_code", { count: "exact" })
      .eq("shift_sheet_id", sheet.id)
      .gte("work_date", firstDate)
      .lte("work_date", lastDate)
      .order("id")
      .range(from, to)
      .abortSignal(request.signal)) : [];

    const { assignments, shortages } = assignNightShifts({
      dates,
      staffs,
      fixedCells,
      existingAssignments,
      nightShiftLimit,
      nightStaffCount,
    });
    return reply({ fixedCells, nightAssignments: assignments, nightShortages: shortages });
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (error instanceof FixedLeaveValidationError) return reply({ error: error.message }, 422);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "シフト作成に必要な情報を取得する権限がありません。" }, 403);
    }
    return reply({ error: "月間シフトの生成準備ができませんでした。" }, 500);
  }
}
