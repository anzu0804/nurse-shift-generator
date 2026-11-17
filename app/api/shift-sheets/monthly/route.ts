import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { isMonthlyShiftMonth, type MonthlyShift } from "@/lib/monthly-shift";
import { readSavedMonthlyShift } from "@/lib/saved-monthly-shift";

function reply(body: MonthlyShift | { error: string }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!isMonthlyShiftMonth(month)) {
    return reply({ error: "対象年月をYYYY-MM形式で指定してください。" }, 400);
  }

  try {
    const supabase = await getAuthenticatedSupabase(request);
    const saved = await readSavedMonthlyShift(supabase, month, request.signal);
    return saved ? reply(saved) : reply({ error: "シフト表が更新されました。再読み込みしてください。" }, 409);
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "月間業務予定表を閲覧する権限がありません。" }, 403);
    }
    return reply({ error: "月間業務予定表を取得できませんでした。再読み込みしてください。" }, 500);
  }
}
