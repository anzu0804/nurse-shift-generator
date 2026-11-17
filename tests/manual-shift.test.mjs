import assert from "node:assert/strict";
import test from "node:test";
import { parseManualEdit } from "../lib/manual-shift.ts";
import { validateSavedShift } from "../lib/saved-shift-validation.ts";

test("manual edit accepts partial changes and explicit clearing", () => {
  assert.deepEqual(parseManualEdit({ version: 2, teamAssignment: "", note: " 交代 ", workAmount: 0.5 }), {
    version: 2,
    changes: { team_assignment: null, note: "交代", work_amount: 0.5 },
  });
  assert.deepEqual(parseManualEdit({ version: 1, shiftCode: " 公 " }), {
    version: 1, changes: { shift_code: "公" },
  });
});

test("manual edit rejects invalid values and server-owned fields", () => {
  for (const edit of [
    { shiftCode: null }, { workAmount: NaN }, { workAmount: 0.25 }, { workAmount: "1" },
    { teamAssignment: "C" }, { is_manual_edit: false }, { note: "a\0b" }, { staff_id: 7 }, {},
  ]) assert.equal(parseManualEdit({ version: 1, ...edit }), null);
  assert.equal(parseManualEdit({ version: 0, shiftCode: "A" }), null);
});

const date = "2026-11-01";
const staff = (id, team, role, can_night_shift = true) => ({
  id, team, role, can_night_shift, job_type: "正看護師",
  is_active: true, employment_status: "在籍中", display_order: id,
});
const cell = (staff_id, shift_code, team_assignment = null, work_date = date) => ({
  staff_id, shift_code, work_date, team_assignment, note: null, assignment_role: null,
  work_amount: ["公", "明"].includes(shift_code) ? 0 : 1,
});
const conditions = {
  weekday_day_staff_count: 2, saturday_day_staff_count: 2, sunday_day_staff_count: 2,
  night_staff_count: 1, night_shift_next_day_after: true, default_night_shift_limit: 4,
  max_consecutive_work_days: 5, balance_weekend_shifts: false,
};
const scenario = {
  dates: [{ date, weekday: 0 }],
  assignments: [cell(1, "A", "B"), cell(2, "A", "A"), cell(3, "D"), cell(4, "公")],
  adjacent: [cell(3, "明", null, "2026-11-02")],
  staffs: [staff(1, "A", "主任"), staff(2, "B", "リーダー"), staff(3, "B", "一般"), staff(4, "B", "一般", false)],
  leaves: [{ staff_id: 4, leave_date: date, leave_type: "夏休み", status: "確定" }],
  ngPairs: [],
  conditions,
};

test("valid saved assignments use the actual teams and adjacent recovery cell", () => {
  assert.deepEqual(validateSavedShift(scenario), []);
});

test("revalidation reports whole-sheet conflicts without generating substitute assignments", () => {
  const result = validateSavedShift({
    ...scenario,
    assignments: [cell(1, "公"), cell(2, "A", "A"), cell(3, "公"), cell(4, "D"), cell(5, "D")],
    staffs: [...scenario.staffs, staff(5, "B", "一般")],
    adjacent: [],
    ngPairs: [{ staff_a_id: 4, staff_b_id: 5, is_active: true }],
  });
  for (const code of ["E001", "E002", "E003", "E004", "E005", "E006", "E007"]) {
    assert.ok(result.some((issue) => issue.validation_code === code), code);
  }
  assert.ok(result.some((issue) => issue.validation_code === "E007" && issue.work_date === "2026-11-02"));
});

test("revalidation checks previous-month night work, repeating bath days, and existing balances", () => {
  const results = validateSavedShift({
    ...scenario,
    adjacent: [...scenario.adjacent, cell(1, "D", null, "2026-10-31")],
    bathEvents: [{ event_date: "2026-10-04", recurrence_type: "毎月", recurrence_rule: "第1日曜日" }],
    balances: [{ staff_id: 4, available_holidays: 2 }],
  });
  assert.ok(results.some((issue) => issue.validation_code === "E007" && issue.staff_id === 1));
  assert.equal(results.filter((issue) => issue.validation_code === "E009").length, 2);
  assert.ok(results.some((issue) => issue.validation_code === "W003" && issue.staff_id === 4 && /割当は0日/.test(issue.message)));
});
