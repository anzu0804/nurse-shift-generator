import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { assignDayShifts, getConsecutiveWorkWarnings, isDayShiftStaff } from "@/lib/day-shift";
import { FixedLeaveValidationError, prepareFixedLeaves } from "@/lib/fixed-leave";
import { readMonthlyLeaveRequests, readPages } from "@/lib/monthly-leave-requests";
import { isMonthlyShiftMonth, monthDates } from "@/lib/monthly-shift";
import { getNgPairViolations, indexNgPairs } from "@/lib/ng-pairs";
import { offsetShiftDate } from "@/lib/night-after";
import { assignNightShifts, isNightShiftStaff } from "@/lib/night-shift";
import { monthlyGenerationChecks, shiftValidationError, type ShiftValidationResult } from "@/lib/shift-validation";
import { countWeekendWork, getWeekendImbalance, weekendDates } from "@/lib/weekend-shift";

type PreparedShift = {
  fixedCells: ReturnType<typeof prepareFixedLeaves>["fixedCells"];
  nightAssignments: ReturnType<typeof assignNightShifts>["assignments"];
  nightShortages: ReturnType<typeof assignNightShifts>["shortages"];
  nightAfterFixedCells: ReturnType<typeof assignNightShifts>["nightAfterFixedCells"];
  nightAfterConflicts: ReturnType<typeof assignNightShifts>["nightAfterConflicts"];
  dayAssignments: ReturnType<typeof assignDayShifts>["assignments"];
  dayShortages: ReturnType<typeof assignDayShifts>["shortages"];
  warnings: (
    ReturnType<typeof assignNightShifts>["nightLimitWarnings"][number] |
    ReturnType<typeof getConsecutiveWorkWarnings>[number] |
    ReturnType<typeof getWeekendImbalance>[number]
  )[];
  dayTeamShortages: ReturnType<typeof assignDayShifts>["teamShortages"];
  dayLeadershipShortages: ReturnType<typeof assignDayShifts>["leadershipShortages"];
};

function reply(
  body: (PreparedShift | { error: string }) & { validationResults: ShiftValidationResult[] },
  status = 200,
) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

function errorReply(issue: ShiftValidationResult, status: number) {
  return reply({ error: issue.message, validationResults: [issue] }, status);
}

export async function POST(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!isMonthlyShiftMonth(month)) {
    return errorReply(shiftValidationError("INVALID_MONTH", "対象年月をYYYY-MM形式で指定してください。"), 400);
  }

  try {
    const supabase = await getAuthenticatedSupabase(request);
    const dates = monthDates(month);
    const firstDate = month + "-01";
    const lastDate = dates[dates.length - 1].date;
    const [year, monthNumber] = month.split("-").map(Number);
    const { data: conditions, error: conditionsError } = await supabase
      .from("shift_conditions")
      .select("default_night_shift_limit, night_staff_count, night_shift_next_day_after, weekday_day_staff_count, saturday_day_staff_count, sunday_day_staff_count, max_consecutive_work_days, balance_weekend_shifts")
      .eq("target_year", year)
      .eq("target_month", monthNumber)
      .abortSignal(request.signal)
      .maybeSingle();
    if (conditionsError) throw conditionsError;

    if (!conditions) {
      return errorReply(shiftValidationError("E011", "対象月のシフト作成条件が未登録です。条件管理で保存してください。"), 422);
    }

    const nightShiftLimit = conditions.default_night_shift_limit ?? 4;
    const balanceWeekendShifts = conditions.balance_weekend_shifts ?? true;
    const weekends = balanceWeekendShifts ? weekendDates(dates) : undefined;
    const nightStaffCount = conditions.night_staff_count ?? 0;
    const nightShiftNextDayAfter = conditions.night_shift_next_day_after ?? true;
    if (![nightShiftLimit, nightStaffCount].every((value) => Number.isInteger(value) && value >= 0)) {
      return errorReply(shiftValidationError("INVALID_CONDITIONS", "夜勤上限と夜勤必要人数に0以上の整数を指定してください。"), 422);
    }

    const dayRequirements = {
      weekday: conditions.weekday_day_staff_count ?? 0,
      saturday: conditions.saturday_day_staff_count ?? 0,
      sunday: conditions.sunday_day_staff_count ?? 0,
    };
    const maxConsecutiveWorkDays = conditions.max_consecutive_work_days ?? 5;
    if (!Object.values(dayRequirements).every((value) => Number.isInteger(value) && value >= 0)) {
      return errorReply(shiftValidationError("INVALID_CONDITIONS", "日勤必要人数に0以上の整数を指定してください。"), 422);
    }
    if (!Number.isInteger(maxConsecutiveWorkDays) || maxConsecutiveWorkDays < 1) {
      return errorReply(shiftValidationError("INVALID_CONDITIONS", "連続勤務上限に1以上の整数を指定してください。"), 422);
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
        .select("staff_id, work_date, shift_code, work_amount, team_assignment", { count: "exact" })
        .eq("shift_sheet_id", sheet.id)
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal));
    }

    async function readAdjacentAssignments(boundary: string, direction: -1 | 1) {
      let remaining = maxConsecutiveWorkDays;
      let edge = offsetShiftDate(boundary, direction);
      const assignments: Awaited<ReturnType<typeof readAssignments>> = [];

      while (edge && remaining > 0) {
        const month = edge.slice(0, 7);
        const daysInRange = direction === -1 ? Number(edge.slice(-2)) : monthDates(month).length;
        const days = Math.min(remaining, daysInRange);
        const farDay = direction === -1 ? daysInRange - days + 1 : days;
        const farDate = month + "-" + String(farDay).padStart(2, "0");
        const startDate = direction === -1 ? farDate : edge;
        const endDate = direction === -1 ? edge : farDate;
        const rows = await readAssignments(startDate, endDate);
        if (rows.length === 0) break;
        assignments.push(...rows);
        remaining -= days;
        edge = offsetShiftDate(farDate, direction);
      }

      return assignments;
    }

    const nextDate = nightShiftNextDayAfter ? offsetShiftDate(lastDate, 1) : undefined;
    const [leaveRequests, staffs, currentAssignments, previousAssignments, nextAssignments, ngPairs] = await Promise.all([
      readMonthlyLeaveRequests(supabase, firstDate, nextDate ?? lastDate, request.signal),
      readPages((from, to) => supabase
        .from("staffs")
        .select("id, employment_status, is_active, can_night_shift, job_type, display_order, team, role", { count: "exact" })
        .eq("employment_status", "在籍中")
        .eq("is_active", true)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal)),
      readAssignments(firstDate, lastDate),
      readAdjacentAssignments(firstDate, -1),
      readAdjacentAssignments(lastDate, 1),
      readPages((from, to) => supabase
        .from("ng_pairs")
        .select("staff_a_id, staff_b_id, is_active", { count: "exact" })
        .eq("is_active", true)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal)),
    ]);
    const ngPairPartners = indexNgPairs(ngPairs);
    const { fixedCells } = prepareFixedLeaves(nextDate ? [...dates, { date: nextDate }] : dates, leaveRequests);
    const existingAssignments = [...previousAssignments, ...currentAssignments, ...nextAssignments];
    const { assignments, shortages, nightAfterFixedCells, nightAfterConflicts, nightLimitWarnings } = assignNightShifts({
      dates,
      staffs,
      fixedCells,
      existingAssignments,
      nightShiftLimit,
      nightStaffCount,
      nightShiftNextDayAfter,
      weekends,
      ngPairPartners,
    });
    const lockedCells = [...fixedCells, ...assignments, ...nightAfterFixedCells];
    const {
      assignments: dayAssignments,
      shortages: dayShortages,
      teamShortages: dayTeamShortages,
      leadershipShortages: dayLeadershipShortages,
    } = assignDayShifts({
      dates,
      staffs,
      existingAssignments,
      fixedCells: lockedCells,
      requirements: dayRequirements,
      maxConsecutiveWorkDays,
      balanceWeekendShifts,
      ngPairPartners,
    });
    const weekendWarnings = weekends ? getWeekendImbalance(
      staffs.filter((staff) => isDayShiftStaff(staff) || isNightShiftStaff(staff)).map(({ id }) => id),
      countWeekendWork(weekends, currentAssignments, lockedCells, dayAssignments),
    ) : [];
    const consecutiveWorkWarnings = getConsecutiveWorkWarnings(
      dates, [existingAssignments, lockedCells, dayAssignments], maxConsecutiveWorkDays,
    );
    const prepared: PreparedShift = {
      fixedCells: fixedCells.filter(({ work_date }) => work_date !== nextDate),
      nightAssignments: assignments,
      nightShortages: shortages,
      nightAfterFixedCells,
      nightAfterConflicts,
      dayAssignments,
      dayShortages,
      dayTeamShortages,
      dayLeadershipShortages,
      warnings: [...nightLimitWarnings, ...consecutiveWorkWarnings, ...weekendWarnings],
    };
    const ngPairViolations = getNgPairViolations(currentAssignments, ngPairPartners);
    return reply({ ...prepared, validationResults: monthlyGenerationChecks({ ...prepared, ngPairViolations }) });
  } catch (error) {
    if (error instanceof AuthError) {
      return errorReply(shiftValidationError("AUTH_ERROR", error.message), error.status);
    }
    if (error instanceof FixedLeaveValidationError) {
      const issue = shiftValidationError(error.validationCode, error.issueMessage, {
        staff_id: error.staffId,
        work_date: error.workDate,
      });
      return reply({ error: error.message, validationResults: [issue] }, 422);
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return errorReply(shiftValidationError("ACCESS_DENIED", "シフト作成に必要な情報を取得する権限がありません。"), 403);
    }
    return errorReply(shiftValidationError("PREPARATION_FAILED", "月間シフトの生成準備ができませんでした。"), 500);
  }
}
