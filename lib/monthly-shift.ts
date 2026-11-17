import type { EditableShift } from "./manual-shift.ts";
import type { ShiftValidationResult } from "./shift-validation.ts";

export type MonthlyAssignment = EditableShift & {
  id: number;
  is_manual_edit: boolean;
  staff_id: number;
  work_date: string;
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
  validationResults: ShiftValidationResult[];
};

export function isMonthlyShiftMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month) && Number(month.slice(0, 4)) >= 100;
}

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
