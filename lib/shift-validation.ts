import type { assignDayShifts, getConsecutiveWorkWarnings } from "./day-shift.ts";
import type { NgPairViolation } from "./ng-pairs.ts";
import type { assignNightShifts } from "./night-shift.ts";
import type { getWeekendImbalance } from "./weekend-shift.ts";

export type ShiftValidationResult = {
  severity: "error" | "warning";
  validation_code: string;
  message: string;
  staff_id?: number;
  related_staff_id?: number;
  work_date?: string;
};

type GenerationChecks = {
  nightShortages: ReturnType<typeof assignNightShifts>["shortages"];
  nightAfterConflicts: ReturnType<typeof assignNightShifts>["nightAfterConflicts"];
  dayShortages: ReturnType<typeof assignDayShifts>["shortages"];
  dayTeamShortages: ReturnType<typeof assignDayShifts>["teamShortages"];
  ngPairViolations?: readonly NgPairViolation[];
  warnings: (
    ReturnType<typeof assignNightShifts>["nightLimitWarnings"][number] |
    ReturnType<typeof getConsecutiveWorkWarnings>[number] |
    ReturnType<typeof getWeekendImbalance>[number]
  )[];
};

export function shiftValidationError(
  validation_code: string,
  message: string,
  location: Pick<ShiftValidationResult, "staff_id" | "related_staff_id" | "work_date"> = {},
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
    ...(checks.ngPairViolations ?? []).map(({ work_date, shift, staff_a_id, staff_b_id }) =>
      shiftValidationError("E003", `${shift}にNGペアのスタッフ #${staff_a_id} と #${staff_b_id} が配置されています。`,
        { work_date, staff_id: staff_a_id, related_staff_id: staff_b_id },
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
      if (warning.code === "W002") {
        return {
          severity: "warning",
          validation_code: warning.code,
          message: `連続勤務が少なくとも${warning.count}日あり、上限の${warning.limit}日を超えています。`,
          staff_id: warning.staff_id,
          work_date: warning.work_date,
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
