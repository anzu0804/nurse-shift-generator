"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PageHeader from "@/components/common/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { manualShiftAmounts } from "@/lib/manual-shift";
import type { MonthlyAssignment, MonthlyShift } from "@/lib/monthly-shift";
import { supabase } from "@/lib/supabase";
import { MonthlyReportTable } from "./MonthlyReportTable";

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

function EditCell({ cell, version, onClose, onSaved }: {
  cell: MonthlyAssignment;
  version: number;
  onClose: () => void;
  onSaved: (version: number) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const amount = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const fields = new FormData(event.currentTarget);
    const original = {
      shiftCode: cell.shift_code,
      teamAssignment: cell.team_assignment ?? "",
      assignmentRole: cell.assignment_role ?? "",
      workAmount: cell.work_amount,
      note: cell.note ?? "",
    };
    const changes = Object.fromEntries(Object.entries(original).flatMap(([key, before]) => {
      const value = fields.get(key);
      const after = key === "workAmount" ? Number(value) : value;
      return after === before ? [] : [[key, after]];
    }));
    if (Object.keys(changes).length === 0) {
      onClose();
      return;
    }

    setError("");
    setSaving(true);
    try {
      const headers = await sessionHeaders();
      if (!headers) {
        setError("ログインし直してから保存してください。");
        return;
      }
      const response = await fetch("/api/shift-assignments/" + cell.id, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ version, ...changes }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "勤務割当を保存できませんでした。");
        return;
      }
      await onSaved(body.version);
    } catch {
      setError("保存結果を確認できませんでした。編集画面を閉じて「表示」で確認してください。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="edit-cell-title"
      onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}
      className="m-auto w-[min(30rem,calc(100%-2rem))] rounded-xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-900/40">
      <h2 id="edit-cell-title" className="text-lg font-semibold">勤務割当を編集</h2>
      <p className="mt-1 text-sm text-slate-600">{cell.staff?.name ?? "スタッフ #" + cell.staff_id} · {cell.work_date}</p>
      <form onSubmit={save}>
        <fieldset disabled={saving} className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            勤務記号
            <select name="shiftCode" defaultValue={cell.shift_code} className={controlClass}
              onChange={(event) => {
                const suggested = manualShiftAmounts.get(event.target.value);
                if (amount.current && typeof suggested === "number") amount.current.value = String(suggested);
              }}>
              {!manualShiftAmounts.has(cell.shift_code) && <option>{cell.shift_code}</option>}
              {[...manualShiftAmounts.keys()].map((code) => <option key={code}>{code}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            配置チーム
            <select name="teamAssignment" defaultValue={cell.team_assignment ?? ""} className={controlClass}>
              <option value="">指定なし</option>
              <option>A</option>
              <option>B</option>
              <option>フリー</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            配置役割
            <input name="assignmentRole" maxLength={50} defaultValue={cell.assignment_role ?? ""} className={controlClass} />
          </label>
          <label className="grid gap-1 text-sm">
            勤務実績
            <input ref={amount} name="workAmount" type="number" min={0} max={99.9} step={0.1} required defaultValue={cell.work_amount} className={controlClass} />
          </label>
          <label className="grid gap-1 text-sm">
            備考
            <textarea name="note" rows={2} maxLength={2000} defaultValue={cell.note ?? ""} className={controlClass} />
          </label>
          {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" className={controlClass} onClick={onClose}>キャンセル</button>
            <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </fieldset>
      </form>
    </dialog>
  );
}

async function sessionHeaders() {
  const { data, error } = await supabase.auth.getSession();
  if (!error && data.session) return { Authorization: "Bearer " + data.session.access_token };
}

async function fetchMonthlySchedule(month: string, headers: { Authorization: string }, signal?: AbortSignal) {
  return fetch("/api/shift-sheets/monthly?month=" + month, { headers, signal, cache: "no-store" });
}

function MonthlySchedule({ month }: { month: string }) {
  const router = useRouter();
  const [result, setResult] = useState<LoadResult | null>(null);
  const [editing, setEditing] = useState<MonthlyAssignment | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const headers = await sessionHeaders();
        if (controller.signal.aborted) return;
        if (!headers) {
          router.replace("/login");
          return;
        }

        const response = await fetchMonthlySchedule(month, headers, controller.signal);
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          router.replace("/login");
          return;
        }
        if (!response.ok) {
          const body = await response.json();
          if (!controller.signal.aborted) setResult({ status: "error", message: body.error });
          return;
        }

        const data: MonthlyShift = await response.json();
        if (!controller.signal.aborted) setResult({ status: "loaded", data });
      } catch {
        if (!controller.signal.aborted) {
          setResult({ status: "error", message: "月間業務予定表を取得できませんでした。もう一度「表示」を押してください。" });
        }
      }
    }

    void load();
    return () => controller.abort();
  }, [month, router]);

  async function reloadAfterSave(version: number) {
    try {
      const headers = await sessionHeaders();
      if (!headers) throw new Error();
      const response = await fetchMonthlySchedule(month, headers);
      if (!response.ok) throw new Error();
      const data: MonthlyShift = await response.json();
      if (!data.sheet || data.sheet.version < version ||
        !data.assignments.some((cell) => cell.id === editing?.id && cell.is_manual_edit)) throw new Error();
      setResult({ status: "loaded", data });
      setNotice("保存しました。");
    } catch {
      setResult({ status: "error", message: "保存しましたが、再表示できませんでした。「表示」で読み込み直してください。" });
    } finally {
      setEditing(null);
    }
  }

  if (!result) return <p role="status">月間業務予定表を読み込み中です…</p>;
  if (result.status === "error") return <p role="alert" className="text-rose-700">{result.message}</p>;

  const { sheet, assignments, validationResults } = result.data;
  if (!sheet) return <p role="status">この月の月間業務予定表は未作成です。</p>;

  const staffNames = new Map(assignments.map(({ staff_id, staff }) => [staff_id, staff?.name]));
  const errors = validationResults.filter(({ severity }) => severity === "error").length;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge label={sheet.status} />
        <span className="text-sm text-slate-600">バージョン {sheet.version}</span>
        {notice && <span role="status" className="text-sm text-emerald-700">{notice}</span>}
      </div>
      {validationResults.length > 0 && (
        <details open key={sheet.version} className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          <summary className="cursor-pointer font-medium">検証結果 · エラー {errors}件、警告 {validationResults.length - errors}件</summary>
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto">
            {validationResults.map((issue, index) => (
              <li key={index} className={issue.severity === "error" ? "text-rose-800" : "text-amber-900"}>
                {issue.severity === "error" ? "エラー" : "警告"} {issue.validation_code}
                {issue.work_date && ` · ${issue.work_date}`}
                {issue.staff_id && ` · ${staffNames.get(issue.staff_id) ?? "スタッフ #" + issue.staff_id}`} {issue.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      {assignments.length === 0
        ? <p role="status">このシフト表には勤務割当がありません。</p>
        : <MonthlyReportTable month={month} assignments={assignments} onEdit={(cell) => { setNotice(""); setEditing(cell); }} />}
      {editing && <EditCell cell={editing} version={sheet.version} onClose={() => setEditing(null)} onSaved={reloadAfterSave} />}
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
