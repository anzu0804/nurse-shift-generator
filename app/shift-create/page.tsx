"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PageHeader from "@/components/common/PageHeader";
import { isMonthlyShiftMonth } from "@/lib/monthly-shift";
import { shiftValidationError, type ShiftValidationResult } from "@/lib/shift-validation";
import { supabase } from "@/lib/supabase";

function ValidationList({ severity, issues }: {
  severity: ShiftValidationResult["severity"];
  issues: ShiftValidationResult[];
}) {
  const isError = severity === "error";
  const title = isError ? "エラー" : "警告";
  const color = isError
    ? "border-rose-200 bg-rose-50 text-rose-950"
    : "border-amber-200 bg-amber-50 text-amber-950";

  return (
    <section aria-label={title} className={`rounded-lg border p-4 ${color}`}>
      <h3 className="font-semibold">{title} {issues.length}件</h3>
      {issues.length > 0 && (
        <ul className="mt-2 max-h-72 divide-y divide-current/15 overflow-auto text-sm" tabIndex={0} aria-label={title + "一覧"}>
          {issues.map(({ validation_code, message, work_date, staff_id }, index) => (
            <li key={index} className="space-y-1 py-2">
              <div className="flex flex-wrap items-center gap-x-3">
                <span className="font-mono text-xs">{validation_code}</span>
                {work_date && <time dateTime={work_date}>{work_date}</time>}
                {staff_id !== undefined && (
                  <Link className="underline underline-offset-2" href={`/staffs/${staff_id}`}>
                    スタッフ #{staff_id}
                  </Link>
                )}
              </div>
              <p>{message}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const repairLinks = {
  conditions: { href: "/conditions", label: "条件管理" },
  staffs: { href: "/staffs", label: "スタッフ管理" },
  leaves: { href: "/leave-requests", label: "希望休管理" },
  schedule: { href: "/shift-edit", label: "シフト編集" },
};

function repairLinksFor(code: string): (keyof typeof repairLinks)[] {
  if (code.startsWith("LEAVE_")) return ["leaves"];
  switch (code) {
    case "E004": return ["conditions", "staffs", "leaves"];
    case "E006": return ["staffs", "leaves", "schedule"];
    case "E007": return ["schedule", "leaves"];
    case "W001":
    case "W002":
    case "W012": return ["conditions", "schedule"];
    case "E011":
    case "INVALID_CONDITIONS": return ["conditions"];
    default: return [];
  }
}

function ValidationReport({ month, issues }: { month: string; issues: ShiftValidationResult[] }) {
  const errors = issues.filter(({ severity }) => severity === "error");
  const warnings = issues.filter(({ severity }) => severity === "warning");
  const links = new Set(issues.flatMap(({ validation_code }) => repairLinksFor(validation_code)));

  return (
    <section aria-label="チェック結果" className="mt-6 space-y-3">
      <h2 className="font-semibold">{month} のチェック結果</h2>
      <p role={errors.length ? "alert" : "status"} className="text-sm text-slate-700">
        {errors.length > 0 ? `エラーが${errors.length}件あります。` :
          warnings.length > 0 ? `警告が${warnings.length}件あります。` :
          "今回のチェックでエラー・警告は検出されませんでした。"}
      </p>
      <ValidationList severity="error" issues={errors} />
      <ValidationList severity="warning" issues={warnings} />
      {links.size > 0 && (
        <div className="space-y-2 text-sm">
          <p>対象月の登録内容を確認し、修正後に「再チェック」を押してください。</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-2">
            {[...links].map((key) => (
              <li key={key}>
                <Link
                  href={repairLinks[key].href}
                  target="_blank"
                  rel="noopener"
                  className="text-blue-700 underline underline-offset-2"
                >
                  {repairLinks[key].label}（別タブ）
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function ShiftCreatePage() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).format(new Date()));
  const [issues, setIssues] = useState<ShiftValidationResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  async function runCheck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current || !isMonthlyShiftMonth(month)) return;

    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setIssues(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (controller.signal.aborted) return;
      if (error || !data.session) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/shift-sheets/monthly/prepare?month=" + month, {
        method: "POST",
        headers: { Authorization: "Bearer " + data.session.access_token },
        signal: controller.signal,
        cache: "no-store",
      });
      if (controller.signal.aborted) return;
      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      const body: { validationResults?: ShiftValidationResult[] } = await response.json();
      if (!controller.signal.aborted) {
        if (!Array.isArray(body.validationResults) || (!response.ok && body.validationResults.length === 0)) {
          throw new Error("Missing validation results");
        }
        setIssues(body.validationResults);
      }
    } catch {
      if (!controller.signal.aborted) {
        setIssues([shiftValidationError("CHECK_FAILED", "チェック結果を取得できませんでした。「再チェック」を押してください。")]);
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setLoading(false);
      }
    }
  }

  return (
    <div className="text-slate-900">
      <PageHeader title="シフト表作成" />
      <section aria-labelledby="monthly-check-heading" className="max-w-4xl rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 id="monthly-check-heading" className="text-lg font-semibold">月間業務予定表の生成前チェック</h2>
        <p className="mt-1 text-sm text-slate-600">登録済みの条件で割当を試算し、エラーと警告を確認します。</p>
        <form onSubmit={runCheck} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm font-medium">
            対象年月
            <input
              type="month"
              required
              min="0100-01"
              max="9999-12"
              value={month}
              disabled={loading}
              onChange={(event) => {
                setMonth(event.target.value);
                setIssues(null);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={loading || !isMonthlyShiftMonth(month)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {issues ? "再チェック" : "生成前チェック"}
          </button>
        </form>
        {loading && <p role="status" className="mt-4 text-sm text-slate-600">チェック中です…</p>}
        {issues && <ValidationReport month={month} issues={issues} />}
      </section>
    </div>
  );
}
