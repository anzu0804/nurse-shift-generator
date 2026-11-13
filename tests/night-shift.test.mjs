import assert from "node:assert/strict";
import test from "node:test";
import { prepareFixedLeaves, staffDateKey } from "../lib/fixed-leave.ts";
import { monthDates } from "../lib/monthly-shift.ts";
import { assignNightShifts, getNightShiftCandidates } from "../lib/night-shift.ts";

const dates = monthDates("2028-02").slice(0, 3);
const [first, second, third] = dates.map(({ date }) => date);

function staff(id, overrides = {}) {
  return {
    id,
    employment_status: "在籍中",
    is_active: true,
    can_night_shift: true,
    display_order: id,
    ...overrides,
  };
}

function cell(staff_id, work_date, shift_code = "D") {
  return { staff_id, work_date, shift_code };
}

function assign(overrides = {}) {
  return assignNightShifts({
    dates,
    staffs: [staff(1), staff(2), staff(3)],
    fixedCells: [],
    existingAssignments: [],
    nightShiftLimit: 2,
    nightStaffCount: 1,
    ...overrides,
  });
}

test("在籍・有効・夜勤可のスタッフから空きセルと月間上限を満たす候補を絞る", () => {
  const staffs = [
    staff(1),
    staff(2),
    staff(3, { employment_status: "休職中" }),
    staff(4, { employment_status: "退職済み" }),
    staff(5, { is_active: false }),
    staff(6, { can_night_shift: false }),
    staff(7),
  ];
  const occupied = new Set([staffDateKey(1, first)]);
  const counts = new Map([[2, 2]]);
  assert.deepEqual(getNightShiftCandidates(staffs, first, occupied, counts, 2).map(({ id }) => id), [7]);
});

test("申請済みと確定の希望休を避け、取消の日は割り当てられる", () => {
  const { fixedCells } = prepareFixedLeaves(dates, [
    { staff_id: 1, leave_date: first, leave_type: "有給", status: "申請済み" },
    { staff_id: 1, leave_date: second, leave_type: "生理休暇", status: "確定" },
    { staff_id: 1, leave_date: third, leave_type: "有給", status: "取消" },
  ]);
  assert.deepEqual(assign({ staffs: [staff(1)], fixedCells }), {
    assignments: [cell(1, third)],
    shortages: [
      { work_date: first, missing_count: 1 },
      { work_date: second, missing_count: 1 },
    ],
  });
  assert.deepEqual(fixedCells.map(({ shift_code }) => shift_code), ["有", "生"]);
});

test("既存セルを保護し、対象月の既存夜勤を日別人数と月間上限に含める", () => {
  const existingAssignments = [
    cell(1, second),
    cell(2, first, "A"),
    cell(3, "2028-01-31"),
  ];
  assert.deepEqual(assign({ existingAssignments, nightShiftLimit: 1 }), {
    assignments: [cell(3, first), cell(2, third)],
    shortages: [],
  });
  assert.equal(existingAssignments[1].shift_code, "A");
});

test("夜勤回数が少ない候補を優先し、同日重複と人数超過を防ぐ", () => {
  assert.deepEqual(assign({ staffs: [staff(1), staff(1), staff(2), staff(3)], nightStaffCount: 2 }), {
    assignments: [
      cell(1, first), cell(2, first),
      cell(3, second), cell(1, second),
      cell(2, third), cell(3, third),
    ],
    shortages: [],
  });
});

test("必要人数0なら追加せず、上限0なら不足を返す", () => {
  assert.deepEqual(assign({ nightStaffCount: 0 }), { assignments: [], shortages: [] });
  assert.deepEqual(assign({ nightShiftLimit: 0, nightStaffCount: 2 }), {
    assignments: [],
    shortages: dates.map(({ date }) => ({ work_date: date, missing_count: 2 })),
  });
});
