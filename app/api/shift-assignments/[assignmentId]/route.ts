import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { HolidayCalendarError } from "@/lib/japanese-holidays";
import { manualShiftAmounts, parseManualEdit, positiveInteger } from "@/lib/manual-shift";
import { readMonthlyLeaveRequests, readPages } from "@/lib/monthly-leave-requests";
import { monthDates } from "@/lib/monthly-shift";
import { offsetShiftDate } from "@/lib/night-after";
import { HolidayVersionConflict, readPublicHolidays } from "@/lib/saved-public-holidays";
import { readMonthlyAssignments, readMonthlySheet } from "@/lib/saved-monthly-shift";
import { validateSavedShift } from "@/lib/saved-shift-validation";

function reply(body: { error: string } | { version: number }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const client = await getAuthenticatedSupabase(request);
    const { assignmentId } = await params;
    const id = Number(assignmentId);
    const edit = parseManualEdit(await request.json().catch(() => null));
    if (!/^\d+$/.test(assignmentId) || !positiveInteger(id) || !edit) {
      return reply({ error: "勤務割当ID、バージョン、編集内容を確認してください。" }, 400);
    }

    const { signal } = request;
    const { data: target, error: targetError } = await client.from("shift_assignments")
      .select("shift_sheet_id, work_date, sheet:shift_sheets!inner(sheet_type, target_year, target_month, version, week_number)")
      .eq("id", id)
      .abortSignal(signal)
      .maybeSingle()
      .overrideTypes<{
        shift_sheet_id: number;
        work_date: string;
        sheet: { sheet_type: string; target_year: number; target_month: number; version: number; week_number: number | null };
      }, { merge: false }>();
    if (targetError) throw targetError;
    // RLS hides the row from accounts without access.
    if (!target) return reply({ error: "勤務割当が見つかりません。" }, 404);

    const sheet = target.sheet;
    if (sheet.sheet_type !== "monthly_schedule" || sheet.week_number !== null) {
      return reply({ error: "月間業務予定表の勤務割当を指定してください。" }, 400);
    }
    const { target_year: year, target_month: monthNumber } = sheet;
    const month = String(year).padStart(4, "0") + "-" + String(monthNumber).padStart(2, "0");
    const dates = monthDates(month);
    const first = dates[0].date;
    const last = dates[dates.length - 1].date;
    if (target.work_date < first || target.work_date > last) {
      return reply({ error: "勤務日が対象月の範囲外です。" }, 400);
    }

    const latest = await readMonthlySheet(client, month, signal);
    if (!latest || sheet.version !== edit.version || latest.id !== target.shift_sheet_id || latest.version !== edit.version) {
      return reply({ error: "シフト表が更新されています。「表示」で読み込み直してください。" }, 409);
    }

    const [{ data: conditions, error: conditionsError }, assignments, leaves, staffs, ngPairs, bathEvents, balances] = await Promise.all([
      client.from("shift_conditions")
        .select("weekday_day_staff_count, saturday_day_staff_count, sunday_day_staff_count, night_staff_count, night_shift_next_day_after, default_night_shift_limit, max_consecutive_work_days, balance_weekend_shifts, free_day_staff_count, free_night_staff_count, assistant_day_staff_count, assistant_late_staff_count, bath_nurse_count, bath_assistant_count")
        .eq("target_year", year).eq("target_month", monthNumber).abortSignal(signal).maybeSingle(),
      readMonthlyAssignments(client, latest.id, first, last, signal),
      readMonthlyLeaveRequests(client, first, last, signal),
      readPages((from, to) => client.from("staffs")
        .select("id, role, team, job_type, employment_status, is_active, can_night_shift, display_order", { count: "exact" })
        .order("id").range(from, to).abortSignal(signal)),
      readPages((from, to) => client.from("ng_pairs")
        .select("staff_a_id, staff_b_id, is_active", { count: "exact" })
        .eq("is_active", true).order("id").range(from, to).abortSignal(signal)),
      readPages((from, to) => client.from("events")
        .select("event_date, recurrence_type, recurrence_rule", { count: "exact" })
        .eq("event_type", "入浴日").lte("event_date", last)
        .order("id").range(from, to).abortSignal(signal)),
      readPublicHolidays(client, month, signal).then(({ rows }) => rows.flatMap((row) =>
        row.available_holidays === null ? [] : [{ staff_id: row.staff_id, available_holidays: row.available_holidays }],
      )).catch((error: unknown) => {
        if (error instanceof HolidayCalendarError) return [];
        throw error;
      }),
    ]);
    if (conditionsError) throw conditionsError;
    const cell = assignments.find((item) => item.id === id);
    if (!cell) return reply({ error: "勤務割当が見つかりません。" }, 404);
    if (edit.changes.shift_code && edit.changes.shift_code !== cell.shift_code &&
      !manualShiftAmounts.has(edit.changes.shift_code)) {
      return reply({ error: "勤務記号を選択してください。" }, 400);
    }

    async function readAdjacent(boundary: string, direction: -1 | 1) {
      const rows = [];
      let remaining = Math.max(1, conditions?.max_consecutive_work_days ?? 5);
      let edge = offsetShiftDate(boundary, direction);
      while (edge && remaining > 0) {
        const adjacentMonth = edge.slice(0, 7);
        const monthDays = monthDates(adjacentMonth);
        const available = direction === -1 ? Number(edge.slice(-2)) : monthDays.length;
        const take = Math.min(available, remaining);
        const far = monthDays[direction === -1 ? available - take : take - 1].date;
        const adjacentSheet = await readMonthlySheet(client, adjacentMonth, signal);
        if (!adjacentSheet) break;
        rows.push(...await readMonthlyAssignments(client, adjacentSheet.id,
          direction === -1 ? far : edge, direction === -1 ? edge : far, signal));
        remaining -= take;
        edge = offsetShiftDate(far, direction);
      }
      return rows;
    }

    const [previous, next] = await Promise.all([readAdjacent(first, -1), readAdjacent(last, 1)]);
    const validation = validateSavedShift({
      dates, adjacent: [...previous, ...next], conditions, leaves, staffs, ngPairs, bathEvents, balances,
      assignments: assignments.map((cell) => cell.id === id ? { ...cell, ...edit.changes } : cell),
    });

    const { data: version, error } = await client.rpc("edit_monthly_shift_assignment", {
      p_assignment_id: id,
      p_expected_version: edit.version,
      p_changes: edit.changes,
      p_validation: validation,
    });
    if (error) throw error;
    return reply({ version });
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code === "42501") return reply({ error: "シフト表を編集する権限がありません。" }, 403);
    if (code === "P0002") return reply({ error: "勤務割当が見つかりません。" }, 404);
    if (error instanceof HolidayVersionConflict || code === "40001" || code === "23505") {
      return reply({ error: "シフト表が更新されています。「表示」で読み込み直してください。" }, 409);
    }
    if (code === "22023" || code === "23514") return reply({ error: "勤務割当の編集内容を確認してください。" }, 400);
    return reply({ error: "保存結果を確認できませんでした。「表示」でシフト表を読み込み直してください。" }, 500);
  }
}
