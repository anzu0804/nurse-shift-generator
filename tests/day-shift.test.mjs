import assert from "node:assert/strict";
import test from "node:test";
import { assignDayShifts, getDayShiftCandidates, requiredDayShiftCount } from "../lib/day-shift.ts";
import { staffDateKey } from "../lib/fixed-leave.ts";
import { monthDates } from "../lib/monthly-shift.ts";

const dates = monthDates("2026-11");
const [sunday, monday, tuesday] = dates.map(({ date }) => date);

function staff(id, overrides = {}) {
  return {
    id,
    employment_status: "在籍中",
    is_active: true,
    job_type: "正看護師",
    display_order: id,
    ...overrides,
  };
}

function cell(staff_id, work_date, shift_code, work_amount) {
  return { staff_id, work_date, shift_code, ...(work_amount === undefined ? {} : { work_amount }) };
}

function prepare(overrides) {
  return assignDayShifts({
    dates: dates.slice(0, 1),
    staffs: [staff(1), staff(2), staff(3)],
    existingAssignments: [],
    fixedCells: [],
    requirements: { weekday: 1, saturday: 2, sunday: 3 },
    maxConsecutiveWorkDays: 5,
    ...overrides,
  });
}

test("uses the configured weekday, Saturday and Sunday counts, including zero", () => {
  const requirements = { weekday: 0, saturday: 2, sunday: 3 };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map((day) => requiredDayShiftCount(day, requirements)),
    [3, 0, 0, 0, 0, 0, 2]);
  const result = prepare({ dates: dates.slice(0, 7), staffs: [], requirements });
  assert.deepEqual(result.shortages, [
    { work_date: sunday, missing_count: 3 },
    { work_date: dates[6].date, missing_count: 2 },
  ]);
});

test("counts existing day work and keeps leave, night, recovery and other occupied cells", () => {
  const result = prepare({
    staffs: Array.from({ length: 8 }, (_, index) => staff(index + 1)),
    existingAssignments: [
      cell(1, sunday, "A/カ"),
      cell(2, sunday, "A"),
      cell(6, sunday, "研修", 1),
      cell(7, sunday, "JA"),
    ],
    fixedCells: [cell(2, sunday, "有"), cell(3, sunday, "D"), cell(4, sunday, "明"), cell(5, sunday, "公")],
  });
  assert.deepEqual(result.assignments, [cell(8, sunday, "A")]);
  assert.deepEqual(result.shortages, [{ work_date: sunday, missing_count: 1 }]);
});

test("can fill day shifts with eligible staff who cannot work nights", () => {
  const result = prepare({
    staffs: [
      staff(1, { employment_status: "休職中" }),
      staff(2, { is_active: false }),
      staff(3, { job_type: "夜勤バイト" }),
      staff(4, { job_type: "補助看護師", can_night_shift: false }),
    ],
  });
  assert.deepEqual(result.assignments, [cell(4, sunday, "A")]);
  assert.deepEqual(result.shortages, [{ work_date: sunday, missing_count: 2 }]);
});

test("counts work on both sides across month boundaries and allows exactly the limit", () => {
  const existingAssignments = [
    cell(1, "2026-10-31", "D"),
    cell(1, monday, "A/コ"),
    cell(2, "2026-10-31", "研修", 0.5),
    cell(2, monday, "明"),
    cell(2, tuesday, "A"),
    cell(3, "2026-10-31", "研修", 0),
    cell(3, monday, "JA"),
  ];
  const cells = new Map(existingAssignments.map((row) => [staffDateKey(row.staff_id, row.work_date), row]));
  assert.deepEqual(getDayShiftCandidates([staff(1), staff(2), staff(3)], sunday, cells, 2)
    .map(({ id }) => id), [2, 3]);
  const endOfMonth = date => dates.find((day) => day.date === date);
  assert.deepEqual(prepare({
    dates: [endOfMonth("2026-11-30")],
    staffs: [staff(1)],
    existingAssignments: [cell(1, "2026-12-01", "D")],
    maxConsecutiveWorkDays: 1,
  }).shortages, [{ work_date: "2026-11-30", missing_count: 1 }]);
});

test("counts new day assignments towards subsequent days and uses later fixed work", () => {
  const result = prepare({
    dates: dates.slice(0, 3).reverse(),
    staffs: [staff(1)],
    fixedCells: [cell(1, tuesday, "D")],
    requirements: { weekday: 1, saturday: 1, sunday: 1 },
    maxConsecutiveWorkDays: 2,
  });
  assert.deepEqual(result.assignments, [cell(1, sunday, "A")]);
  assert.deepEqual(result.shortages, [
    { work_date: monday, missing_count: 1 },
    { work_date: tuesday, missing_count: 1 },
  ]);
});

test("prefers fewer workdays and uses display order for tied candidates", () => {
  const result = prepare({
    staffs: [staff(1), staff(2, { display_order: 5 }), staff(3)],
    existingAssignments: [cell(1, monday, "D")],
    dates: dates.slice(0, 2),
    requirements: { weekday: 0, saturday: 0, sunday: 1 },
  });
  assert.deepEqual(result.assignments, [cell(3, sunday, "A")]);
});
