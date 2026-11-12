export type MonthlyAssignment = {
  staff_id: number;
  work_date: string;
  shift_code: string;
  staff: {
    name: string;
    employee_no: string;
    display_order: number | null;
  } | null;
  requestedLeave: boolean;
};

export type MonthlyShift = {
  sheet: { id: number; status: string; version: number } | null;
  assignments: MonthlyAssignment[];
};

export function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = index + 1;
    const date = month + "-" + String(day).padStart(2, "0");
    const weekday = new Date(Date.UTC(year, monthNumber - 1, day)).getUTCDay();
    return { day, date, weekday };
  });
}
