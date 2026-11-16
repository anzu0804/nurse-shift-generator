import type { assignDayShifts } from "./day-shift.ts";
import type { assignNightShifts } from "./night-shift.ts";
import type { getWeekendImbalance } from "./weekend-shift.ts";

export type ShiftValidationResult = {
  severity: "error" | "warning";
  validation_code: string;
  message: string;
  staff_id?: number;
  work_date?: string;
};

type GenerationChecks = {
  nightShortages: ReturnType<typeof assignNightShifts>["shortages"];
  nightAfterConflicts: ReturnType<typeof assignNightShifts>["nightAfterConflicts"];
  dayShortages: ReturnType<typeof assignDayShifts>["shortages"];
  dayTeamShortages: ReturnType<typeof assignDayShifts>["teamShortages"];
  warnings: (
    ReturnType<typeof assignNightShifts>["nightLimitWarnings"][number] |
    ReturnType<typeof getWeekendImbalance>[number]
  )[];
};

export function shiftValidationError(
  validation_code: string,
  message: string,
  location: Pick<ShiftValidationResult, "staff_id" | "work_date"> = {},
): ShiftValidationResult {
  return { severity: "error", validation_code, message, ...location };
}

export function monthlyGenerationChecks(checks: GenerationChecks): ShiftValidationResult[] {
  const shortages = [
    ...checks.nightShortages.map((row) => ({ ...row, shift: "夜勤" })),
    ...checks.dayShortages.map((row) => ({ ...row, shift: "日勤" })),
    ...checks.dayTeamShortages.map((row) => ({ ...row, shift: `日勤（${row.team}チーム）` })),
  ];

  return [
    ...shortages.map(({ work_date, missing_count, shift }) =>
      shiftValidationError("E004", `${shift}の必要人数に${missing_count}人不足しています。`, { work_date }),
    ),
    ...checks.nightAfterConflicts.map(({ code, staff_id, work_date, night_date, conflicting_shift_code }) =>
      shiftValidationError(code,
        `${night_date}の夜勤の翌日に「${conflicting_shift_code}」が入っているため、夜勤明け（明）を配置できません。`,
        { staff_id, work_date },
      ),
    ),
    ...checks.warnings.map((warning): ShiftValidationResult => {
      if (warning.code === "W001") {
        return {
          severity: "warning",
          validation_code: warning.code,
          message: `夜勤が${warning.count}回あり、上限の${warning.limit}回を超えています。`,
          staff_id: warning.staff_id,
        };
      }
      return {
        severity: "warning",
        validation_code: warning.code,
        message: `土日勤務は最少${warning.min_count}日、最多${warning.max_count}日で、${warning.max_count - warning.min_count}日の差があります。`,
      };
    }),
  ];
}
