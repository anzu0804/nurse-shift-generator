"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import type { PublicHolidays } from "@/lib/saved-public-holidays";
import { supabase } from "@/lib/supabase";

const control = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm disabled:opacity-50";

function currentMonth() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit",
  }).format(new Date());
}

async function requestBalance(path: string, options: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("ログインが必要です。");
  const response = await fetch("/api/public-holiday-balances" + path, {
    ...options,
    cache: "no-store",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "公休情報を取得できませんでした。");
  return body;
}

export default function PublicHolidaysPage() {
  const router = useRouter();
  const [inputMonth, setInputMonth] = useState(currentMonth);
  const [query, setQuery] = useState(() => ({ month: inputMonth }));
  const [result, setResult] = useState<{ query: typeof query; data?: PublicHolidays; error?: string }>();
  const [initialStaff, setInitialStaff] = useState<number | null>(null);
  const [initialAmount, setInitialAmount] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const current = result?.query === query ? result : undefined;

  useEffect(() => {
    const controller = new AbortController();
    const [year, number] = query.month.split("-");
    requestBalance("?year=" + year + "&month=" + number, { signal: controller.signal })
      .then((data: PublicHolidays) => {
        if (!controller.signal.aborted) setResult({ query, data });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        if (error.message === "ログインが必要です。") router.replace("/login");
        setResult({ query, error: error.message });
      });
    return () => controller.abort();
  }, [query, router]);

  function showMonth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInitialStaff(null);
    setSaveError("");
    setQuery({ month: inputMonth });
  }

  async function initialize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (initialStaff === null || initialAmount === "") return;
    setSaving(true);
    setSaveError("");
    const [target_year, target_month] = query.month.split("-").map(Number);
    try {
      await requestBalance("/initialize", {
        method: "POST",
        body: JSON.stringify({
          staff_id: initialStaff, target_year, target_month, carried_over_holidays: Number(initialAmount),
        }),
      });
      setInitialStaff(null);
      setQuery({ month: query.month });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "初期残公休数を登録できませんでした。");
    } finally {
      setSaving(false);
    }
  }

  const staff = current?.data?.rows.find((row) => row.staff_id === initialStaff);
  return (
    <section className="space-y-5">
      <PageHeader title="公休確認" />
      <form onSubmit={showMonth} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          対象年月
          <input className={control} type="month" required value={inputMonth} disabled={saving}
            onChange={(event) => setInputMonth(event.target.value)} />
        </label>
        <button className={control} disabled={saving}>更新</button>
      </form>

      {!current && <p role="status">読み込み中…</p>}
      {current?.error && <p role="alert" className="text-red-700">{current.error}</p>}
      {current?.data && (
        <>
          {!current.data.hasSavedSchedule && <p className="text-sm text-slate-600">対象月の保存済みシフトはありません。</p>}
          {staff && (
            <form onSubmit={initialize} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <label className="grid gap-1 text-sm font-medium">
                {staff.name}の初期残公休数（日）
                <input className={control} type="number" min="0" step="0.5" required value={initialAmount} disabled={saving}
                  onChange={(event) => setInitialAmount(event.target.value)} />
              </label>
              <button className={control} disabled={saving}>保存</button>
              <button className={control} type="button" disabled={saving} onClick={() => setInitialStaff(null)}>キャンセル</button>
              {saveError && <p role="alert" className="w-full text-sm text-red-700">{saveError}</p>}
            </form>
          )}
          {current.data.rows.length === 0 ? <p>表示できるスタッフがいません。</p> : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full whitespace-nowrap text-left text-sm">
                <caption className="sr-only">{query.month}の公休一覧（日数）</caption>
                <thead className="bg-slate-100">
                  <tr>
                    {["社員番号", "氏名", "当月公休数", "前公（前月繰越）", "使用済公休数", "残公（翌月繰越予定）", "操作"].map((label) => (
                      <th key={label} scope="col" className="px-4 py-3">{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {current.data.rows.map((row) => (
                    <tr key={row.staff_id} className="border-t border-slate-200">
                      <td className="px-4 py-3">{row.employee_no}</td>
                      <th scope="row" className="px-4 py-3 font-medium">{row.name}</th>
                      <td className="px-4 py-3">{row.calculated_holidays}</td>
                      <td className="px-4 py-3">{row.carried_over_holidays ?? "未登録"}</td>
                      <td className="px-4 py-3">{row.used_current_holidays + row.used_carried_holidays}</td>
                      <td className={"px-4 py-3 " + ((row.remaining_holidays ?? 0) < 0 ? "text-red-700" : "")}>
                        {row.remaining_holidays ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.can_initialize && (
                          <button className={control} disabled={saving} onClick={() => {
                            setInitialStaff(row.staff_id);
                            setInitialAmount("");
                            setSaveError("");
                          }}>初期残公休登録</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
