import assert from "node:assert/strict";
import test from "node:test";
import { prepareFixedLeaves } from "../lib/fixed-leave.ts";
import { monthlyGenerationChecks } from "../lib/shift-validation.ts";

const emptyChecks = {
  nightShortages: [],
  dayShortages: [],
  dayTeamShortages: [],
  nightAfterConflicts: [],
  warnings: [],
};

test("必要人数不足・夜勤明け競合と夜勤上限・土日偏りを区別する", () => {
  const date = "2026-12-03";
  const shortage = { work_date: date, missing_count: 2 };
  const issues = monthlyGenerationChecks({
    nightShortages: [shortage],
    dayShortages: [shortage],
    dayTeamShortages: [{ ...shortage, team: "A", missing_count: 1 }],
    nightAfterConflicts: [{
      code: "E007", staff_id: 4, night_date: "2026-12-02", work_date: date, conflicting_shift_code: "有",
    }],
    warnings: [
      { code: "W001", staff_id: 5, count: 6, limit: 4 },
      { code: "W012", min_count: 1, max_count: 4, staff_counts: [] },
    ],
  });

  assert.deepEqual(issues.map(({ severity, validation_code }) => [severity, validation_code]), [
    ["error", "E004"], ["error", "E004"], ["error", "E004"], ["error", "E007"],
    ["warning", "W001"], ["warning", "W012"],
  ]);
  assert.deepEqual(issues.slice(0, 4).map(({ work_date }) => work_date), Array(4).fill(date));
  assert.match(issues[0].message, /夜勤.*2人/);
  assert.match(issues[1].message, /日勤.*2人/);
  assert.match(issues[2].message, /Aチーム.*1人/);
  assert.equal(issues[3].staff_id, 4);
  assert.match(issues[3].message, /2026-12-02.*「有」/);
  assert.equal(issues[4].staff_id, 5);
  assert.match(issues[4].message, /6回.*4回/);
  assert.match(issues[5].message, /最少1日、最多4日.*3日/);
});

test("指摘がない場合は空配列を返す", () => {
  assert.deepEqual(monthlyGenerationChecks(emptyChecks), []);
});

test("希望休の入力エラーを種類とスタッフ・日付で特定できる", () => {
  const date = "2026-12-03";
  const leave = { staff_id: 4, leave_date: date, leave_type: "有給", status: "確定" };

  assert.throws(() => prepareFixedLeaves([{ date }], [leave, leave]), {
    validationCode: "LEAVE_DUPLICATE", staffId: 4, workDate: date,
  });
  assert.throws(() => prepareFixedLeaves([], [leave]), {
    validationCode: "LEAVE_OUTSIDE_MONTH", staffId: 4, workDate: date,
  });
  assert.throws(() => prepareFixedLeaves([{ date }], [{ ...leave, leave_type: "未対応" }]), {
    validationCode: "LEAVE_TYPE_UNSUPPORTED", staffId: 4, workDate: date,
  });
});
