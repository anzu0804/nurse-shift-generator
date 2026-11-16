import { dayShiftCodes, NIGHT_SHIFT_CODE, type ShiftCell } from "./shift-work.ts";

export type NgPair = {
  staff_a_id: number;
  staff_b_id: number;
  is_active: boolean;
};

export type NgPairPartners = ReadonlyMap<number, ReadonlySet<number>>;

export function indexNgPairs(pairs: readonly NgPair[]): NgPairPartners {
  const partners = new Map<number, Set<number>>();
  for (const { staff_a_id, staff_b_id, is_active } of pairs) {
    if (is_active !== true || staff_a_id === staff_b_id) continue;
    for (const [staffId, partnerId] of [[staff_a_id, staff_b_id], [staff_b_id, staff_a_id]]) {
      const ids = partners.get(staffId) ?? new Set<number>();
      ids.add(partnerId);
      partners.set(staffId, ids);
    }
  }
  return partners;
}

export function hasNgPairConflict(
  partners: NgPairPartners,
  staffId: number,
  isAssigned: (partnerId: number) => boolean,
) {
  for (const partner of partners.get(staffId) ?? []) {
    if (isAssigned(partner)) return true;
  }
  return false;
}

export function isNgPairDayShift(shiftCode: string | undefined) {
  return shiftCode === "JA" || (shiftCode !== undefined && dayShiftCodes.has(shiftCode));
}

export type NgPairViolation = {
  work_date: string;
  shift: "日勤" | "夜勤";
  staff_a_id: number;
  staff_b_id: number;
};

export function getNgPairViolations(assignments: readonly ShiftCell[], partners: NgPairPartners) {
  const violations: NgPairViolation[] = [];
  const dayByDate = new Map<string, Set<number>>();
  const nightByDate = new Map<string, Set<number>>();

  for (const { staff_id, work_date, shift_code } of assignments) {
    if (!partners.has(staff_id)) continue;
    const isNight = shift_code === NIGHT_SHIFT_CODE;
    if (!isNight && !isNgPairDayShift(shift_code)) continue;

    const byDate = isNight ? nightByDate : dayByDate;
    const assigned = byDate.get(work_date) ?? new Set<number>();
    if (assigned.has(staff_id)) continue;
    assigned.add(staff_id);
    byDate.set(work_date, assigned);

    for (const partner of partners.get(staff_id) ?? []) {
      if (!assigned.has(partner)) continue;
      violations.push({
        work_date,
        shift: isNight ? "夜勤" : "日勤",
        staff_a_id: Math.min(staff_id, partner),
        staff_b_id: Math.max(staff_id, partner),
      });
    }
  }
  return violations;
}
