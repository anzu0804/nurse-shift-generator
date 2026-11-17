import { NextResponse } from "next/server";
import { AuthError, getAuthenticatedSupabase } from "@/lib/authenticated-supabase";
import { readPages } from "@/lib/monthly-leave-requests";
import { reportWeek } from "@/lib/report-calendar";
import { readMonthlyAssignments, readSavedMonthlyShift } from "@/lib/saved-monthly-shift";
import { buildWeeklyReports, type ReportConditions, type ReportEntry, type ReportStaff, type WeeklyReports } from "@/lib/weekly-reports";

function reply(body: WeeklyReports | { error: string }, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Authorization" },
  });
}

export async function GET(request: Request) {
  const dates = reportWeek(new URL(request.url).searchParams.get("date") ?? "");
  if (!dates.length) return reply({ error: "対象週の日付を指定してください。" }, 400);

  try {
    const client = await getAuthenticatedSupabase(request);
    const { signal } = request;
    const start = dates[0].date;
    const end = dates[6].date;
    const months = [...new Set(dates.map(({ date }) => date.slice(0, 7)))];
    const readDutySheet = async () => {
      const { data, error } = await client.from("shift_sheets").select("id, version")
        .eq("sheet_type", "weekly_assignment").eq("week_start_date", start).eq("week_end_date", end)
        .neq("status", "未作成").order("version", { ascending: false }).order("id", { ascending: false })
        .limit(1).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    };
    const [monthly, dutySheet, staff, meetings, events, conditions] = await Promise.all([
      Promise.all(months.map((month) => readSavedMonthlyShift(client, month, signal))),
      readDutySheet(),
      readPages((from, to) => client.from("staffs").select("id, name, job_type, team, role", { count: "exact" })
        .order("id").range(from, to).abortSignal(signal)
        .overrideTypes<ReportStaff[], { merge: false }>()),
      readPages((from, to) => client.from("meetings")
        .select("id, meeting_name, meeting_date, time_period, recurrence_type, recurrence_rule, meeting_staffs(staff_id)", { count: "exact" })
        .eq("is_active", true).order("id").range(from, to).abortSignal(signal)),
      readPages((from, to) => client.from("events")
        .select("id, event_name, event_date, time_period, recurrence_type, recurrence_rule, event_type", { count: "exact" })
        .order("id").range(from, to).abortSignal(signal)),
      Promise.all(months.map(async (month) => {
        const [year, monthNumber] = month.split("-").map(Number);
        const { data, error } = await client.from("shift_conditions").select("bath_nurse_count, bath_assistant_count")
          .eq("target_year", year).eq("target_month", monthNumber).abortSignal(signal).maybeSingle()
          .overrideTypes<ReportConditions, { merge: false }>();
        if (error) throw error;
        return data;
      })),
    ]);
    if (monthly.some((record) => record === null)) {
      return reply({ error: "月間業務予定表が更新されました。再表示してください。" }, 409);
    }

    const saved = dutySheet ? await readMonthlyAssignments(client, dutySheet.id, start, end, signal) : null;
    const latestDutySheet = await readDutySheet();
    if (dutySheet?.id !== latestDutySheet?.id || dutySheet?.version !== latestDutySheet?.version) {
      return reply({ error: "週間業務分担表が更新されました。再表示してください。" }, 409);
    }

    const entries: ReportEntry[] = [
      ...meetings.map((meeting) => ({
        id: meeting.id, name: meeting.meeting_name, date: meeting.meeting_date,
        period: meeting.time_period, recurrence_type: meeting.recurrence_type,
        recurrence_rule: meeting.recurrence_rule, kind: "meeting" as const,
        staffIds: meeting.meeting_staffs.map(({ staff_id }: { staff_id: number }) => staff_id),
      })),
      ...events.map((event) => ({
        id: event.id, name: event.event_name, date: event.event_date,
        period: event.time_period, recurrence_type: event.recurrence_type,
        recurrence_rule: event.recurrence_rule, kind: "event" as const,
        eventType: event.event_type, staffIds: [],
      })),
    ];

    return reply(buildWeeklyReports({
      dates, staff, entries,
      monthly: monthly.flatMap((record) => record?.assignments ?? []),
      savedDuties: saved?.map((cell) => ({ ...cell, requestedLeave: false })) ?? null,
      monthlyIssues: monthly.flatMap((record) => record?.validationResults.filter(({ work_date, severity }) =>
        severity === "error" || !work_date || (work_date >= start && work_date <= end)) ?? []),
      missingMonths: months.filter((_, index) => !monthly[index]?.sheet || monthly[index]?.sheet?.status === "未作成"),
      conditions: new Map(months.flatMap((month, index) => conditions[index] ? [[month, conditions[index]]] : [])),
    }));
  } catch (error) {
    if (error instanceof AuthError) return reply({ error: error.message }, error.status);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "42501") {
      return reply({ error: "週間帳票を閲覧する権限がありません。" }, 403);
    }
    return reply({ error: "週間帳票を取得できませんでした。再表示してください。" }, 500);
  }
}
