import { weekdays } from "../../lib/report-calendar.ts";
import type { WeeklyReports } from "../../lib/weekly-reports.ts";

export const weeklyReportTitles = {
  assignment: "週間業務分担表",
  schedule: "週間業務予定表",
} as const;

export function WeeklyReportTable({ data, mode }: {
  data: WeeklyReports;
  mode: keyof typeof weeklyReportTitles;
}) {
  return (
    <>
      {data.issues.length > 0 && (
        <ul aria-label="エラー・警告" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950">
          {data.issues.map((issue, index) => (
            <li key={index}>{issue.work_date && issue.work_date + " "}{issue.validation_code} {issue.message}</li>
          ))}
        </ul>
      )}
      {data.blocked ? (
        <p role="status">エラーを解消してから週間帳票を作成してください。</p>
      ) : (
        <div role="region" aria-label={weeklyReportTitles[mode]} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full min-w-[52rem] table-fixed border-collapse text-sm">
            <caption className="sr-only">{weeklyReportTitles[mode]}</caption>
            <thead>
              <tr>
                <th scope="col" className="w-24 bg-slate-100 p-2 text-left">項目</th>
                {data.days.map(({ date, weekday }) => (
                  <th scope="col" key={date} className="min-w-24 border border-slate-200 bg-slate-100 p-2">
                    {date.slice(5).replace("-", "/")}（{weekdays[weekday]}）
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(mode === "assignment" ? ["Aチーム", "Bチーム", "その他"] : ["勤務"]).map((label) => (
                <tr key={label}>
                  <th scope="row" className="border border-slate-200 p-2 text-left align-top">{label}</th>
                  {data.days.map((day) => {
                    const duties = mode === "schedule" ? day.schedule : day.assignments.filter(({ team }) =>
                      label === "その他" ? team !== "A" && team !== "B" : team === label[0]);
                    return (
                      <td key={day.date} className="border border-slate-200 p-2 align-top">
                        <ul className="space-y-2">
                          {duties.map((duty) => (
                            <li key={duty.staffId}>
                              {duty.name} <span className={duty.requestedLeave ? "underline decoration-2 underline-offset-4" : ""}>{duty.code}</span>
                              {mode === "schedule" && duty.team && <div>{duty.team === "A" || duty.team === "B" ? duty.team + "チーム" : duty.team}</div>}
                              {duty.role && <div>{duty.role}</div>}
                              {duty.baths.map(({ id, period }) => <div key={id}>{period} 入浴担当</div>)}
                            </li>
                          ))}
                        </ul>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {["AM", "PM", "終日", "時間帯未設定"].map((period) => (
                <tr key={period}>
                  <th scope="row" className="border border-slate-200 p-2 text-left align-top">{period}</th>
                  {data.days.map((day) => (
                    <td key={day.date} className="border border-slate-200 p-2 align-top">
                      <ul className="space-y-2">
                        {day.entries.filter((entry) => period === "時間帯未設定"
                          ? !["AM", "PM", "終日"].includes(entry.period ?? "") : entry.period === period)
                          .map((entry) => (
                            <li key={entry.kind + entry.id}>
                              {entry.kind === "meeting" ? "会議" : entry.eventType ?? "予定"} {entry.name}
                              {entry.participants.length > 0 && <div>{entry.participants.join("、")}</div>}
                            </li>
                          ))}
                      </ul>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
