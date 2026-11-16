export type ShiftCell = {
  staff_id: number;
  work_date: string;
  shift_code: string;
  work_amount?: number | null;
};

export const DAY_SHIFT_CODE = "A";
export const NIGHT_SHIFT_CODE = "D";
export const dayShiftCodes = new Set([DAY_SHIFT_CODE, "A/S", "A/カ", "A/ケ", "A/コ", "A/管"]);
const workShiftCodes = new Set([...dayShiftCodes, NIGHT_SHIFT_CODE, "JA", "JO"]);

export function isWorkShift(cell: ShiftCell | undefined) {
  return cell !== undefined && (
    workShiftCodes.has(cell.shift_code) ||
    (cell.shift_code === "研修" && (cell.work_amount ?? 0) > 0)
  );
}
