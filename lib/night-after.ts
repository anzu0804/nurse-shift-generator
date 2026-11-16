import { staffDateKey } from "./fixed-leave.ts";

export const NIGHT_AFTER_CODE = "明";

export function offsetShiftDate(date: string, days: number) {
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  const shifted = value.toISOString().split("T")[0];
  return /^\d{4}-/.test(shifted) ? shifted : undefined;
}

export function checkNightAfter(
  staffId: number,
  nightDate: string,
  shiftCodes: ReadonlyMap<string, string>,
) {
  const date = offsetShiftDate(nightDate, 1);
  if (!date) return { kind: "outside-calendar" } as const;

  const key = staffDateKey(staffId, date);
  const cell = { staff_id: staffId, work_date: date, shift_code: NIGHT_AFTER_CODE };
  const shiftCode = shiftCodes.get(key);
  if (shiftCode === NIGHT_AFTER_CODE) return { kind: "already-fixed" } as const;

  if (shiftCode !== undefined) {
    return {
      kind: "conflict",
      issue: {
        code: "E007",
        staff_id: staffId,
        night_date: nightDate,
        work_date: date,
        conflicting_shift_code: shiftCode,
      },
    } as const;
  }
  return { kind: "available", key, cell } as const;
}
