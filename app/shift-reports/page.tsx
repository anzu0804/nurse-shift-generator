"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import PageHeader from "@/components/common/PageHeader";
import { reportWeek } from "@/lib/report-calendar";
import { supabase } from "@/lib/supabase";
import type { WeeklyReports } from "@/lib/weekly-reports";
import { WeeklyReportTable, weeklyReportTitles } from "./WeeklyReportTable";

type Mode = keyof typeof weeklyReportTitles;
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm";

export default function ShiftReportsPage() {
  const [mode, setMode] = useState<Mode>("assignment");
  const [date, setDate] = useState(() => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date()));
  const [report, setReport] = useState<WeeklyReports>();
  const [message, setMessage] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setReport(undefined);
    setMessage("週間帳票を作成中です…");
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("ログインし直してください。");
      const response = await fetch(`/api/shift-sheets/weekly?date=${encodeURIComponent(date)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
        signal: controller.signal,
      });
      const payload = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(payload.error ?? "週間帳票を作成できませんでした。");
      setReport(payload);
      setMessage("");
    } catch (error) {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "週間帳票を作成できませんでした。");
    }
  }

  const week = reportWeek(date);

  return (
    <>
      <PageHeader title="シフト帳票" />
      <nav aria-label="帳票の種類" className="mb-4 flex flex-wrap gap-2">
        <Link href="/shift-edit" className={buttonClass}>月間業務予定表</Link>
        {(Object.keys(weeklyReportTitles) as Mode[]).map((type) => (
          <button type="button" key={type} aria-pressed={mode === type} onClick={() => setMode(type)}
            className={`${buttonClass} ${mode === type ? "bg-slate-800 text-white" : "bg-white"}`}>
            {weeklyReportTitles[type]}
          </button>
        ))}
      </nav>
      <section aria-label={weeklyReportTitles[mode]} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-4 text-xl font-semibold">{weeklyReportTitles[mode]}</h2>
        <form onSubmit={generate} className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="report-date">対象週の日付</label>
          <input id="report-date" type="date" value={date} required className={buttonClass} onChange={(event) => {
            request.current?.abort();
            setDate(event.target.value);
            setReport(undefined);
            setMessage("");
          }} />
          <button type="submit" disabled={!week.length} className="rounded-lg bg-blue-700 px-3 py-2 text-sm text-white disabled:opacity-50">
            作成・表示
          </button>
          {week.length > 0 && <span className="text-sm text-slate-600">{week[0].date} ～ {week[6].date}</span>}
        </form>
        {message && <p role="status">{message}</p>}
        {report && <WeeklyReportTable data={report} mode={mode} />}
      </section>
    </>
  );
}
