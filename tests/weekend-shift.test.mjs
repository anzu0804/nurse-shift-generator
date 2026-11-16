import assert from "node:assert/strict";
import test from "node:test";
import { monthDates } from "../lib/monthly-shift.ts";
import { countWeekendWork, getWeekendImbalance, weekendDates } from "../lib/weekend-shift.ts";

const dates = weekendDates(monthDates("2026-11"));
const cell = (staff_id, work_date, shift_code, work_amount) => ({ staff_id, work_date, shift_code, work_amount });

test("counts existing and generated weekend work once per person and date, respecting fixed cells", () => {
  const existing = [
    cell(1, "2026-10-31", "D"),
    cell(1, "2026-11-01", "A/S"),
    cell(1, "2026-11-01", "A/S"),
    cell(1, "2026-11-02", "A"),
    cell(1, "2026-11-07", "A"),
    cell(1, "2026-11-08", "研修", 0),
    cell(2, "2026-11-08", "研修", 0.5),
  ];
  const fixedAndNights = [cell(1, "2026-11-07", "有"), cell(1, "2026-11-14", "D"), cell(1, "2026-11-15", "明")];
  const dayShifts = [cell(1, "2026-11-21", "A")];
  const counts = countWeekendWork(dates, existing, fixedAndNights, dayShifts);
  assert.deepEqual(counts, new Map([[1, 3], [2, 1]]));
  assert.deepEqual(getWeekendImbalance([1, 2, 3], counts), [{
    code: "W012", min_count: 0, max_count: 3,
    staff_counts: [{ staff_id: 1, count: 3 }, { staff_id: 2, count: 1 }, { staff_id: 3, count: 0 }],
  }]);
});

test("a one-day difference and a single staff member do not trigger W012", () => {
  const counts = new Map([[1, 1]]);
  assert.deepEqual(getWeekendImbalance([1, 2], counts), []);
  assert.deepEqual(getWeekendImbalance([1], counts), []);
  assert.deepEqual(getWeekendImbalance([], counts), []);
});
