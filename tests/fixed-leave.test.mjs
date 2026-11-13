import assert from "node:assert/strict";
import test from "node:test";
import { FixedLeaveValidationError, prepareFixedLeaves } from "../lib/fixed-leave.ts";
import { monthDates } from "../lib/monthly-shift.ts";

const dates = monthDates("2028-02");
const requestedLeave = {
  staff_id: 1,
  leave_date: "2028-02-29",
  leave_type: "有給",
  status: "申請済み",
};

test("有効な希望休を固定し、スタッフと日付の組み合わせだけを候補から除外する", () => {
  const confirmedLeave = {
    staff_id: 2,
    leave_date: "2028-02-28",
    leave_type: "生理休暇",
    status: "確定",
  };
  const { fixedCells, isLeaveFixed } = prepareFixedLeaves(dates, [requestedLeave, confirmedLeave]);

  assert.deepEqual(fixedCells, [
    { staff_id: 1, work_date: "2028-02-29", shift_code: "有", leave_type: "有給" },
    { staff_id: 2, work_date: "2028-02-28", shift_code: "生", leave_type: "生理休暇" },
  ]);
  assert.deepEqual([1, 2, 3].filter((staffId) => !isLeaveFixed(staffId, "2028-02-29")), [2, 3]);
  assert.deepEqual([1, 2, 3].filter((staffId) => !isLeaveFixed(staffId, "2028-02-28")), [1, 3]);
});

test("取消は固定せず、同日に有効な申請があっても重複としない", () => {
  const canceled = { ...requestedLeave, status: "取消" };
  const onlyCanceled = prepareFixedLeaves(dates, [canceled]);
  assert.deepEqual(onlyCanceled.fixedCells, []);
  assert.equal(onlyCanceled.isLeaveFixed(1, requestedLeave.leave_date), false);
  assert.equal(prepareFixedLeaves(dates, [canceled, requestedLeave, canceled]).fixedCells.length, 1);
});

test("同一スタッフ・同一日の有効な希望休は種別や状態が異なっても検証エラーになる", () => {
  assert.throws(
    () => prepareFixedLeaves(dates, [
      requestedLeave,
      { ...requestedLeave, leave_type: "夏休み", status: "確定" },
    ]),
    (error) => error instanceof FixedLeaveValidationError && /重複.*2028-02-29.*スタッフID 1/.test(error.message),
  );
});

test("夏休みと誕生日休暇は公で固定し、元の休暇種別を保持する", () => {
  const leaveTypes = ["夏休み", "誕生日", "誕生日休暇"];
  const { fixedCells } = prepareFixedLeaves(dates, leaveTypes.map((leaveType, index) => ({
    ...requestedLeave,
    staff_id: index + 1,
    leave_type: leaveType,
  })));
  assert.deepEqual(fixedCells.map((cell) => [cell.shift_code, cell.leave_type]), [
    ["公", "夏休み"], ["公", "誕生日"], ["公", "誕生日休暇"],
  ]);
});

test("対象月外の有効な希望休や未対応の休暇種別は検証エラーになる", () => {
  assert.throws(
    () => prepareFixedLeaves(dates, [{ ...requestedLeave, leave_date: "2028-03-01" }]),
    { message: /対象月外/ },
  );
  assert.throws(
    () => prepareFixedLeaves(dates, [{ ...requestedLeave, leave_type: "不明" }]),
    { message: /未対応/ },
  );
});
