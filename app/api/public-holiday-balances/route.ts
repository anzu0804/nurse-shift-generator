import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { HolidayCalendarError } from "@/lib/japanese-holidays";
import { positiveInteger } from "@/lib/manual-shift";
import { holidayMonth, HolidayVersionConflict, readPublicHolidays } from "@/lib/saved-public-holidays";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store", Vary: "Authorization" };
  const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  const query = new URL(request.url).searchParams;
  const month = holidayMonth(Number(query.get("year")), Number(query.get("month")));
  const staffId = query.has("staffId") ? Number(query.get("staffId")) : undefined;
  if (!month || (staffId !== undefined && !positiveInteger(staffId))) {
    return reply({ error: "対象年月とスタッフIDを確認してください。" }, 400);
  }

  try {
    const client = await getAuthenticatedSupabase(request);
    return reply(await readPublicHolidays(client, month, request.signal, staffId));
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (error instanceof HolidayCalendarError) return reply({ error: error.message }, 503);
    if (error instanceof HolidayVersionConflict) return reply({ error: "シフトが更新されました。再読み込みしてください。" }, 409);
    if (typeof error === "object" && error && "code" in error && error.code === "42501") {
      return reply({ error: "公休情報を閲覧する権限がありません。" }, 403);
    }
    return reply({ error: "公休情報を取得できませんでした。" }, 500);
  }
}
