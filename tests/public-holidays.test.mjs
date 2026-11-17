import assert from "node:assert/strict";
import test from "node:test";
import { calculateHolidayBalance, calculateHolidayGrant, countHolidayUsage } from "../lib/public-holidays.ts";

test("adds half Saturdays and the monthly grant, counting overlapping holidays once", () => {
  assert.equal(calculateHolidayGrant("2026-05", new Set([
    "2026-05-03", "2026-05-04", "2026-05-05", "2026-05-06",
  ])), 12.5);
  assert.equal(calculateHolidayGrant("2027-01", new Set(["2027-01-01", "2027-01-11"])), 11);
  assert.equal(calculateHolidayGrant("2026-12", new Set()), 10);
});

test("counts half days and distinguishes current from carried usage and special leave", () => {
  const codes = ["公", "前", "マ/コ", "A/コ", "コ/カ", "有", "生", "公", "公", "公", "明", "A"];
  const assignments = codes.map((shift_code, i) => ({
    staff_id: 1, work_date: "2026-11-" + String(i + 1).padStart(2, "0"), shift_code,
  }));
  assignments.push({ staff_id: 1, work_date: "2026-12-01", shift_code: "前" });
  const leaves = [
    ["06", "有給", "確定"], ["07", "生理休暇", "申請済み"],
    ["08", "夏休み", "確定"], ["09", "誕生日", "申請済み"], ["10", "夏休み", "取消"],
  ].map(([day, leave_type, status]) => ({ staff_id: 1, leave_date: "2026-11-" + day, leave_type, status }));

  const before = countHolidayUsage("2026-11", assignments, leaves).get(1);
  assert.deepEqual(before, { used_current_holidays: 3.5, used_carried_holidays: 1.5 });
  assert.equal(calculateHolidayBalance(9, 2.5, before).remaining_holidays, 6.5);

  const after = countHolidayUsage("2026-11", assignments.map((cell, i) =>
    i === 0 ? { ...cell, shift_code: "A" } : cell), leaves).get(1);
  const remaining = calculateHolidayBalance(9, 2.5, after).remaining_holidays;
  assert.equal(remaining, 7.5);
  assert.equal(calculateHolidayBalance(10, remaining).carried_over_holidays, 7.5);
});

test("preserves missing opening balances and shows overuse as a negative remainder", () => {
  assert.equal(calculateHolidayBalance(9, null).remaining_holidays, null);
  assert.equal(calculateHolidayBalance(1, 0, { used_current_holidays: 1.5, used_carried_holidays: 0 }).remaining_holidays, -0.5);
});
