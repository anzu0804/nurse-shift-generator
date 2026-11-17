import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { HolidayCalendarError } from "@/lib/japanese-holidays";
import { positiveInteger } from "@/lib/manual-shift";
import { holidayMonth, HolidayVersionConflict, readPublicHolidays } from "@/lib/saved-public-holidays";

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  try {
    const client = await getAuthenticatedSupabase(request);
    const body = await request.json().catch(() => null);
    const { staff_id, target_year, target_month, carried_over_holidays: carried } = body ?? {};
    const month = holidayMonth(target_year, target_month);
    if (!month || !positiveInteger(staff_id) || typeof carried !== "number" ||
        carried < 0 || !Number.isSafeInteger(carried * 2)) {
      return reply({ error: "対象年月、スタッフ、初期残公休数（0.5日単位）を確認してください。" }, 400);
    }

    const { rows } = await readPublicHolidays(client, month, request.signal, staff_id);
    const row = rows[0];
    if (!row?.can_initialize) {
      return reply({ error: "このスタッフ・対象月には初期残公休数を登録できません。" }, 409);
    }
    const available = row.calculated_holidays + carried;
    // The balance table stores NUMERIC(4,1).
    if (available > 999.5) return reply({ error: "利用可能公休数の上限を超えています。" }, 400);
    const { error } = await client.from("public_holiday_balances").insert({
      staff_id, target_year, target_month,
      calculated_holidays: row.calculated_holidays,
      carried_over_holidays: carried,
      available_holidays: available,
      used_current_holidays: row.used_current_holidays,
      used_carried_holidays: row.used_carried_holidays,
      remaining_holidays: available - row.used_current_holidays - row.used_carried_holidays,
    });
    if (error) throw error;
    return reply({ success: true }, 201);
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (error instanceof HolidayCalendarError) return reply({ error: error.message }, 503);
    if (error instanceof HolidayVersionConflict) return reply({ error: "シフトが更新されました。再読み込みしてください。" }, 409);
    const code = typeof error === "object" && error && "code" in error ? error.code : undefined;
    if (code === "23505") return reply({ error: "対象月の初期残公休数は登録済みです。" }, 409);
    if (code === "42501") return reply({ error: "公休情報を登録する権限がありません。" }, 403);
    return reply({ error: "初期残公休数を登録できませんでした。" }, 500);
  }
}
