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
    nightAfterFixedCells: [],
    nightAfterConflicts: [],
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
    nightAfterFixedCells: [],
    nightAfterConflicts: [],
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
    nightAfterFixedCells: [],
    nightAfterConflicts: [],
    shortages: [],
  });
});

test("必要人数0なら追加せず、上限0なら不足を返す", () => {
  assert.deepEqual(assign({ nightStaffCount: 0 }), {
    assignments: [], shortages: [], nightAfterFixedCells: [], nightAfterConflicts: [],
  });
  assert.deepEqual(assign({ nightShiftLimit: 0, nightStaffCount: 2 }), {
    assignments: [],
    nightAfterFixedCells: [],
    nightAfterConflicts: [],
    shortages: dates.map(({ date }) => ({ work_date: date, missing_count: 2 })),
  });
});

test("明けを直ちに固定し、翌日の夜勤候補から外す", () => {
  const result = assign({
    dates: [...dates].reverse(),
    staffs: [staff(1), staff(1)],
    nightShiftNextDayAfter: true,
  });
  assert.deepEqual(result.assignments, [cell(1, first), cell(1, third)]);
  assert.deepEqual(result.nightAfterFixedCells, [cell(1, second, "明"), cell(1, "2028-02-04", "明")]);
  assert.deepEqual(result.shortages, [{ work_date: second, missing_count: 1 }]);
});

test("希望休と既存勤務が翌日にある候補を避け、既存の明は再作成しない", () => {
  const result = assign({
    dates: [dates[0]],
    fixedCells: [cell(1, second, "有")],
    existingAssignments: [cell(2, second, "A"), cell(3, second, "明")],
    nightShiftNextDayAfter: true,
  });
  assert.deepEqual(result.assignments, [cell(3, first)]);
  assert.deepEqual(result.nightAfterFixedCells, []);
  assert.deepEqual(result.nightAfterConflicts, []);
});

test("既存夜勤の明けを固定し、重複行や既存の明は再作成しない", () => {
  const existingAssignments = [
    cell(1, first), cell(1, first), cell(2, first), cell(2, second, "明"),
  ];
  const result = assign({ existingAssignments, nightStaffCount: 0, nightShiftNextDayAfter: true });
  assert.deepEqual(result.nightAfterFixedCells, [cell(1, second, "明")]);
  assert.deepEqual(result.nightAfterConflicts, []);
  assert.deepEqual(result.assignments, []);
});

test("既存夜勤と希望休または既存勤務の競合はE007として返す", () => {
  const result = assign({
    fixedCells: [cell(1, second, "有")],
    existingAssignments: [
      cell(1, first), cell(1, second, "明"), cell(2, first),
      cell(2, second, "A"), cell(2, second, "明"),
    ],
    nightStaffCount: 0,
    nightShiftNextDayAfter: true,
  });
  assert.deepEqual(result.nightAfterFixedCells, []);
  assert.deepEqual(result.nightAfterConflicts, [
    { code: "E007", staff_id: 1, night_date: first, work_date: second, conflicting_shift_code: "有" },
    { code: "E007", staff_id: 2, night_date: first, work_date: second, conflicting_shift_code: "A" },
  ]);
});

test("前月末の夜勤を月初に反映し、うるう年の月末夜勤は翌月初に固定する", () => {
  const result = assign({
    dates: monthDates("2028-02"),
    existingAssignments: [cell(1, "2028-01-31"), cell(1, "2028-02-29")],
    nightStaffCount: 0,
    nightShiftNextDayAfter: true,
  });
  assert.deepEqual(result.nightAfterFixedCells, [cell(1, first, "明"), cell(1, "2028-03-01", "明")]);
});

test("年をまたぐ既存割当を保護し、設定がfalseなら明け固定と競合検証を行わない", () => {
  const dates = monthDates("2028-12");
  const existingAssignments = [cell(1, "2028-12-31"), cell(1, "2029-01-01", "A")];
  const options = { dates, existingAssignments, nightStaffCount: 0 };
  assert.deepEqual(assign({ ...options, nightShiftNextDayAfter: true }).nightAfterConflicts, [
    { code: "E007", staff_id: 1, night_date: "2028-12-31", work_date: "2029-01-01", conflicting_shift_code: "A" },
  ]);
  const disabled = assign({ ...options, nightShiftNextDayAfter: false });
  assert.deepEqual(disabled.nightAfterFixedCells, []);
  assert.deepEqual(disabled.nightAfterConflicts, []);
});
