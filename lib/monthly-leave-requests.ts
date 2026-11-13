import type { getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { ACTIVE_LEAVE_STATUSES } from "@/lib/fixed-leave";

export async function readPages<T>(
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

export function readMonthlyLeaveRequests(
  supabase: Awaited<ReturnType<typeof getAuthenticatedSupabase>>,
  firstDate: string,
  lastDate: string,
  signal: AbortSignal,
) {
  return readPages((from, to) => supabase
    .from("leave_requests")
    .select("staff_id, leave_date, leave_type, status", { count: "exact" })
    .in("status", ACTIVE_LEAVE_STATUSES)
    .gte("leave_date", firstDate)
    .lte("leave_date", lastDate)
    .order("id")
    .range(from, to)
    .abortSignal(signal),
  );
}
