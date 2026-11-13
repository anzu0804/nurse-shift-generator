import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { FixedLeaveValidationError, prepareFixedLeaves } from "@/lib/fixed-leave";
import { readMonthlyLeaveRequests } from "@/lib/monthly-leave-requests";
import { isMonthlyShiftMonth, monthDates } from "@/lib/monthly-shift";

function reply(body: { fixedCells: ReturnType<typeof prepareFixedLeaves>["fixedCells"] } | { error: string }, status = 200) {
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
    const leaves = await readMonthlyLeaveRequests(
      supabase,
      month + "-01",
      dates[dates.length - 1].date,
      request.signal,
    );
    const { fixedCells } = prepareFixedLeaves(dates, leaves);
    return reply({ fixedCells });
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (error instanceof FixedLeaveValidationError) return reply({ error: error.message }, 422);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "希望休を取得する権限がありません。" }, 403);
    }
    return reply({ error: "シフト作成用の希望休を取得できませんでした。" }, 500);
  }
}
