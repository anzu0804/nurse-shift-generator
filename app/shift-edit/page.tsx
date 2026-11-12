"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { monthDates, type MonthlyAssignment, type MonthlyShift } from "@/lib/monthly-shift";
import { supabase } from "@/lib/supabase";

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
const controlClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50";

type LoadResult =
  | { status: "loaded"; data: MonthlyShift }
  | { status: "error"; message: string };

function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function ShiftTable({ month, assignments }: { month: string; assignments: MonthlyAssignment[] }) {
  const days = monthDates(month);
  const rowsByStaff = new Map<number, {
    staff: MonthlyAssignment["staff"];
    shifts: Map<string, MonthlyAssignment>;
  }>();

  for (const assignment of assignments) {
    const { staff_id, staff, work_date } = assignment;
    const row = rowsByStaff.get(staff_id) ?? { staff, shifts: new Map() };
    row.shifts.set(work_date, assignment);
    rowsByStaff.set(staff_id, row);
  }

  const rows = [...rowsByStaff].sort(([idA, a], [idB, b]) =>
    (a.staff?.display_order ?? 0) - (b.staff?.display_order ?? 0) ||
    (a.staff?.employee_no ?? "").localeCompare(b.staff?.employee_no ?? "", "ja", { numeric: true }) ||
    idA - idB,
  );

  return (
    <>
      <p className="mb-3 text-sm text-slate-600">
        下線は希望休、— は勤務割当なしを示します。
      </p>
      <div
        role="region"
        aria-label="月間業務予定表"
        tabIndex={0}
        className="max-h-[65vh] overflow-auto rounded-lg border border-slate-200 focus-visible:outline-2 focus-visible:outline-blue-600"
      >
        <table className="w-full border-separate border-spacing-0 whitespace-nowrap text-sm">
          <caption className="sr-only">{month} 月間業務予定表</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky top-0 left-0 z-20 min-w-36 border-r border-b border-slate-200 bg-slate-100 px-3 py-2 text-left">
                スタッフ
              </th>
              {days.map(({ date, day, weekday }) => (
                <th
                  key={date}
                  scope="col"
                  className={"sticky top-0 z-10 min-w-12 border-b border-slate-200 px-2 py-2 text-center " +
                    (weekday === 0 ? "bg-rose-50 text-rose-700" :
                      weekday === 6 ? "bg-blue-50 text-blue-700" : "bg-slate-100")}
                >
                  {day}<span className="block text-xs font-normal">{weekdays[weekday]}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([staffId, { staff, shifts }]) => (
              <tr key={staffId} className="group">
                <th scope="row" className="sticky left-0 border-r border-b border-slate-200 bg-white px-3 py-2 text-left group-hover:bg-slate-50">
                  {staff?.name ?? "スタッフ #" + staffId}
                </th>
                {days.map(({ date, weekday }) => {
                  const shift = shifts.get(date);
                  return (
                    <td
                      key={date}
                      className={"border-b border-slate-100 px-2 py-2 text-center group-hover:bg-slate-100 " +
                        (weekday === 0 || weekday === 6 ? "bg-slate-50" : "")}
                    >
                      {shift?.requestedLeave ? (
                        <span className="underline decoration-2 underline-offset-4">
                          <span className="sr-only">希望休 </span>{shift.shift_code}
                        </span>
                      ) : shift?.shift_code ?? <span className="text-slate-400">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MonthlySchedule({ month }: { month: string }) {
  const router = useRouter();
  const [result, setResult] = useState<LoadResult | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (controller.signal.aborted) return;
        if (error || !data.session) {
          router.replace("/login");
          return;
        }

        const response = await fetch("/api/shift-sheets/monthly?month=" + month, {
          headers: { Authorization: "Bearer " + data.session.access_token },
          signal: controller.signal,
          cache: "no-store",
        });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (response.status === 403) {
          setResult({ status: "error", message: "月間業務予定表を閲覧する権限がありません。" });
          return;
        }
        if (!response.ok) throw new Error("Monthly schedule request failed");

        const dataForMonth: MonthlyShift = await response.json();
        if (!controller.signal.aborted) setResult({ status: "loaded", data: dataForMonth });
      } catch {
        if (!controller.signal.aborted) {
          setResult({ status: "error", message: "月間業務予定表を取得できませんでした。もう一度「表示」を押してください。" });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [month, router]);

  if (!result) return <p role="status">月間業務予定表を読み込み中です…</p>;
  if (result.status === "error") return <p role="alert" className="text-rose-700">{result.message}</p>;

  const { sheet, assignments } = result.data;
  if (!sheet) return <p role="status">この月の月間業務予定表は未作成です。</p>;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge label={sheet.status} />
        <span className="text-sm text-slate-600">バージョン {sheet.version}</span>
      </div>
      {assignments.length === 0
        ? <p role="status">このシフト表には勤務割当がありません。</p>
        : <ShiftTable month={month} assignments={assignments} />}
    </>
  );
}

export default function ShiftEditPage() {
  const [month, setMonth] = useState(currentMonth);
  const [reload, setReload] = useState(0);

  function showMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = event.currentTarget.elements.namedItem("month");
    if (!(field instanceof HTMLInputElement)) return;

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(field.value) || Number(field.value.slice(0, 4)) < 100) {
      field.setCustomValidity("対象年月をYYYY-MM形式で指定してください。");
      field.reportValidity();
      return;
    }

    setMonth(field.value);
    setReload((value) => value + 1);
  }

  return (
    <div className="text-slate-900">
      <PageHeader title="月間業務予定表" />
      <section aria-label="月間業務予定表の確認" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <form onSubmit={showMonth} className="mb-5 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            対象年月
            <input
              type="month"
              min="0100-01"
              max="9999-12"
              name="month"
              required
              placeholder="YYYY-MM"
              defaultValue={month}
              onInput={(event) => event.currentTarget.setCustomValidity("")}
              className={controlClass}
            />
          </label>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            表示
          </button>
        </form>
        <MonthlySchedule key={month + "/" + reload} month={month} />
      </section>
    </div>
  );
}
