import { monthDates, type MonthlyAssignment } from "../../lib/monthly-shift.ts";
import { weekdays } from "../../lib/report-calendar.ts";

export function MonthlyReportTable({ month, assignments, onEdit }: {
  month: string;
  assignments: MonthlyAssignment[];
  onEdit: (cell: MonthlyAssignment) => void;
}) {
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
        勤務記号を選択して編集できます。下線は希望休、青色は手動編集済み、— は勤務割当なしです。
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
                      {shift ? (
                        <button
                          type="button"
                          onClick={() => onEdit(shift)}
                          aria-label={`${staff?.name ?? "スタッフ " + staffId} ${date} ${shift.shift_code}${shift.requestedLeave ? " 希望休" : ""}${shift.is_manual_edit ? " 手動編集済み" : ""}を編集`}
                          className={`rounded px-1.5 py-1 hover:bg-blue-100 ${shift.is_manual_edit ? "bg-blue-50 font-semibold text-blue-800" : ""} ${shift.requestedLeave ? "underline decoration-2 underline-offset-4" : ""}`}
                        >
                          {shift.shift_code}
                        </button>
                      ) : <span className="text-slate-400">—</span>}
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
