import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { occurrenceDates, reportWeek } from "../lib/report-calendar.ts";
import { buildWeeklyReports } from "../lib/weekly-reports.ts";

const tableModules = new Set([
  new URL("../app/shift-edit/MonthlyReportTable.tsx", import.meta.url).href,
  new URL("../app/shift-reports/WeeklyReportTable.tsx", import.meta.url).href,
]);
const hooks = registerHooks({
  load(url, context, next) {
    if (!tableModules.has(url)) return next(url, context);
    const { outputText } = ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext },
    });
    return { format: "module", source: outputText, shortCircuit: true };
  },
});
const { MonthlyReportTable } = await import("../app/shift-edit/MonthlyReportTable.tsx");
const { WeeklyReportTable } = await import("../app/shift-reports/WeeklyReportTable.tsx");
hooks.deregister();

const monday = "2026-08-31";
const tuesday = "2026-09-01";
const dates = reportWeek(tuesday);
const staff = [
  { id: 1, name: "佐藤", job_type: "正看護師", team: "A", role: "主任" },
  { id: 2, name: "鈴木", job_type: "正看護師", team: "B", role: "一般" },
  { id: 3, name: "田中", job_type: "正看護師", team: "フリー", role: "一般" },
  { id: 4, name: "山本", job_type: "看護助手", team: "A", role: "一般" },
  { id: 5, name: "木村", job_type: "正看護師", team: "A", role: "一般" },
];
const assignment = (id, date, code, extra = {}) => ({
  id: id + Number(date.slice(-2)) * 10, staff_id: id, work_date: date, shift_code: code,
  team_assignment: null, assignment_role: null, work_amount: 1, note: null,
  is_manual_edit: false, staff: { ...staff[id - 1], employee_no: String(id), display_order: id },
  requestedLeave: false, ...extra,
});
const monthly = [
  assignment(1, monday, "A"), assignment(2, monday, "A/カ"), assignment(3, monday, "A"),
  assignment(4, monday, "JA"), assignment(5, monday, "明"),
  assignment(1, tuesday, "有", { requestedLeave: true, work_amount: 0 }),
];
const meeting = {
  id: 1, name: "委員会", date: monday, period: "PM", kind: "meeting", staffIds: [2],
  recurrence_type: "毎週", recurrence_rule: "毎週月曜日",
};
const bath = {
  id: 1, name: "病棟入浴", date: monday, period: "PM", kind: "event", staffIds: [],
  eventType: "入浴日", recurrence_type: "なし", recurrence_rule: null,
};
const input = {
  dates, monthly, savedDuties: null, staff, entries: [meeting, bath],
  conditions: new Map([["2026-08", { bath_nurse_count: 1, bath_assistant_count: 0 }]]),
  monthlyIssues: [], missingMonths: [],
};

test("月間業務予定表は保存済みの勤務記号と希望休の下線を表示する", () => {
  const html = renderToStaticMarkup(createElement(MonthlyReportTable, {
    month: "2026-09", assignments: [monthly.at(-1)], onEdit() {},
  }));
  assert.match(html, /月間業務予定表/);
  assert.match(html, /佐藤/);
  assert.match(html, /underline[^"]*">有<\/button>/);
});

test("週間業務分担表は会議と重複しない入浴担当とチーム別の役割を表示する", () => {
  const data = buildWeeklyReports(input);
  assert.equal(data.blocked, false);
  assert.deepEqual(data.days[0].assignments.map(({ staffId }) => staffId), [1, 2, 3, 4]);
  assert.deepEqual(data.days[0].assignments.find(({ staffId }) => staffId === 3).baths, [{ id: 1, period: "PM" }]);
  assert.deepEqual(data.days[0].assignments.find(({ staffId }) => staffId === 2).baths, []);
  const html = renderToStaticMarkup(createElement(WeeklyReportTable, { data, mode: "assignment" }));
  for (const label of ["週間業務分担表", "Aチーム", "Bチーム", "主任", "看護助手日勤", "PM 入浴担当", "委員会", "鈴木"]) {
    assert.ok(html.includes(label), label);
  }
});

test("週間業務予定表は週が月をまたいでも月間の勤務記号と保存済み週間役割を参照表示する", () => {
  const data = buildWeeklyReports({
    ...input, entries: [meeting], savedDuties: [assignment(1, monday, "D", {
      team_assignment: "B", assignment_role: "日責",
    })],
  });
  const html = renderToStaticMarkup(createElement(WeeklyReportTable, { data, mode: "schedule" }));
  assert.match(html, /週間業務予定表/);
  assert.match(html, /08\/31（月）/);
  assert.match(html, /09\/01（火）/);
  assert.match(html, /佐藤 <span class="">A<\/span><div>Bチーム<\/div><div>日責<\/div>/);
  assert.match(html, /underline[^"]*">有<\/span>/);
  assert.match(html, />明<\/span>/);
  assert.doesNotMatch(html, /<button|<input/);
});

test("未作成月、重大エラー、未解釈の繰り返し、不足を表示する", () => {
  const missing = buildWeeklyReports({ ...input, missingMonths: ["2026-09"] });
  assert.ok(missing.blocked);
  assert.ok(missing.issues.some(({ validation_code }) => validation_code === "E012"));
  const invalid = buildWeeklyReports({
    ...input, entries: [{ ...meeting, recurrence_rule: "隔週の月曜" }],
    monthlyIssues: [{ severity: "error", validation_code: "E007", message: "夜勤明けの割当なし" }],
  });
  assert.ok(invalid.blocked);
  const html = renderToStaticMarkup(createElement(WeeklyReportTable, { data: invalid, mode: "schedule" }));
  assert.match(html, /E007/);
  assert.match(html, /E013/);
  assert.doesNotMatch(html, /<table/);
  assert.ok(buildWeeklyReports({ ...input, monthly: [monthly[1]] }).issues.some(({ validation_code }) => validation_code === "E009"));
});

test("月曜から日曜を選択し、毎月の日付または第何曜日を展開する", () => {
  assert.equal(dates.at(-1).date, "2026-09-06");
  assert.deepEqual(reportWeek("2026-02-30"), []);
  for (const recurrence_rule of ["毎月1日", "第1火曜日"]) {
    assert.deepEqual(occurrenceDates(dates, { date: null, recurrence_type: "毎月", recurrence_rule }).map(({ date }) => date), [tuesday]);
  }
});
