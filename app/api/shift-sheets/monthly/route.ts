import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { monthDates, type MonthlyAssignment, type MonthlyShift } from "@/lib/monthly-shift";

function reply(body: MonthlyShift | { error: string }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

async function readPages<T>(
  readPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    count: number | null;
    error: { code: string } | null;
  }>,
) {
  const rows: T[] = [];
  const pageSize = 500;

  while (true) {
    const { data, count, error } = await readPage(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (!data || count === null) throw new Error("Missing page result");
    rows.push(...data);
    if (rows.length >= count) return rows;
    if (data.length === 0) throw new Error("Incomplete page result");
  }
}

const leaveCodes: Record<string, string> = {
  有給: "有",
  生理休暇: "生",
  夏休み: "公",
  誕生日: "公",
  誕生日休暇: "公",
};

export async function GET(request: Request) {
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 100) {
    return reply({ error: "対象年月をYYYY-MM形式で指定してください。" }, 400);
  }

  try {
    const supabase = await getAuthenticatedSupabase(request);
    const [year, monthNumber] = month.split("-").map(Number);
    const { data: sheet, error } = await supabase
      .from("shift_sheets")
      .select("id, status, version")
      .eq("sheet_type", "monthly_schedule")
      .eq("target_year", year)
      .eq("target_month", monthNumber)
      .is("week_number", null)
      .order("version", { ascending: false })
      .limit(1)
      .abortSignal(request.signal)
      .maybeSingle();

    if (error) throw error;
    if (!sheet) return reply({ sheet: null, assignments: [] });

    const firstDate = month + "-01";
    const lastDate = monthDates(month).at(-1)!.date;
    const assignments = await readPages<Omit<MonthlyAssignment, "requestedLeave">>(
      (from, to) => supabase
        .from("shift_assignments")
        .select("staff_id, work_date, shift_code, staff:staffs(name, employee_no, display_order)", { count: "exact" })
        .eq("shift_sheet_id", sheet.id)
        .gte("work_date", firstDate)
        .lte("work_date", lastDate)
        .order("id")
        .range(from, to)
        .abortSignal(request.signal)
        .overrideTypes<Omit<MonthlyAssignment, "requestedLeave">[], { merge: false }>(),
    );

    if (assignments.length === 0) return reply({ sheet, assignments: [] });

    const leaves = await readPages((from, to) => supabase
      .from("leave_requests")
      .select("staff_id, leave_date, leave_type", { count: "exact" })
      .in("status", ["申請済み", "確定"])
      .gte("leave_date", firstDate)
      .lte("leave_date", lastDate)
      .order("id")
      .range(from, to)
      .abortSignal(request.signal),
    );
    const leavesByCell = new Map(
      leaves.map((leave) => [leave.staff_id + "/" + leave.leave_date, leaveCodes[leave.leave_type]]),
    );

    return reply({
      sheet,
      assignments: assignments.map((assignment) => ({
        ...assignment,
        requestedLeave:
          leavesByCell.get(assignment.staff_id + "/" + assignment.work_date) === assignment.shift_code,
      })),
    });
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "月間業務予定表を閲覧する権限がありません。" }, 403);
    }
    return reply({ error: "月間業務予定表を取得できませんでした。再読み込みしてください。" }, 500);
  }
}
