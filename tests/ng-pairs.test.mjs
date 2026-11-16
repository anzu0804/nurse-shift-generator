import assert from "node:assert/strict";
import test from "node:test";
import { assignDayShifts } from "../lib/day-shift.ts";
import { monthDates } from "../lib/monthly-shift.ts";
import { getNgPairViolations, indexNgPairs } from "../lib/ng-pairs.ts";
import { assignNightShifts } from "../lib/night-shift.ts";
import { monthlyGenerationChecks } from "../lib/shift-validation.ts";

const dates = monthDates("2026-12");
const date = dates[0].date;

function staff(id, team) {
  return {
    id, team, employment_status: "在籍中", is_active: true,
    job_type: "正看護師", can_night_shift: true, display_order: id,
  };
}

function cell(staff_id, shift_code, work_date = date) {
  return { staff_id, work_date, shift_code };
}

function pair(staff_a_id, staff_b_id, is_active = true) {
  return { staff_a_id, staff_b_id, is_active };
}

test("夜勤は既存夜勤と新規夜勤の両方を照合し、休暇・明け・日勤セルを保護する", () => {
  const fixedCells = [cell(5, "有"), cell(6, "明")];
  const existingAssignments = [cell(1, "D"), cell(7, "A")];
  const { assignments, shortages, nightAfterFixedCells } = assignNightShifts({
    dates: dates.slice(0, 1),
    staffs: [1, 2, 3, 4, 5, 6, 7].map((id) => staff(id)),
    fixedCells,
    existingAssignments,
    nightStaffCount: 3,
    nightShiftLimit: 4,
    nightShiftNextDayAfter: true,
    ngPairPartners: indexNgPairs([pair(2, 1), pair(4, 3), pair(1, 3, false), pair(7, 3)]),
  });

  assert.deepEqual(assignments, [cell(3, "D")]);
  assert.deepEqual(shortages, [{ work_date: date, missing_count: 1 }]);
  assert.deepEqual(nightAfterFixedCells, [cell(1, "明", dates[1].date), cell(3, "明", dates[1].date)]);
  assert.deepEqual(existingAssignments, [cell(1, "D"), cell(7, "A")]);
  assert.deepEqual(fixedCells, [cell(5, "有"), cell(6, "明")]);
});

test("日勤は別チームの既存日勤・助手日勤とチーム優先枠・追加枠の新規日勤を照合する", () => {
  const existingAssignments = [cell(1, "A/カ"), cell(2, "JA")];
  const fixedCells = [cell(8, "D"), cell(9, "明"), cell(10, "有")];
  const { assignments, shortages, teamShortages } = assignDayShifts({
    dates: dates.slice(0, 1),
    staffs: [staff(1, "A"), staff(3, "B"), staff(4, "A"), staff(5, "B"),
      staff(6, "B"), staff(7, "A"), staff(8, "B"), staff(9, "A"), staff(10, "B"), staff(11, "A")],
    existingAssignments,
    fixedCells,
    requirements: { weekday: 5, saturday: 5, sunday: 5 },
    maxConsecutiveWorkDays: 5,
    ngPairPartners: indexNgPairs([pair(3, 1), pair(4, 2), pair(6, 5), pair(11, 7), pair(5, 8)]),
  });

  assert.deepEqual(assignments, [cell(5, "A"), cell(7, "A")]);
  assert.deepEqual(shortages, [{ work_date: date, missing_count: 2 }]);
  assert.deepEqual(teamShortages, [{ work_date: date, team: "B", missing_count: 1 }]);
  assert.deepEqual(existingAssignments, [cell(1, "A/カ"), cell(2, "JA")]);
  assert.deepEqual(fixedCells, [cell(8, "D"), cell(9, "明"), cell(10, "有")]);
});

test("既存割当の両勤務をE003に変換し、逆順重複や別勤務・別日・無効ペアを除外する", () => {
  const partners = indexNgPairs([pair(2, 1), pair(1, 2), pair(1, 3, false)]);
  const assignments = [
    cell(1, "D"), cell(2, "D"), cell(2, "D"), cell(3, "D"),
    cell(2, "JA", dates[1].date), cell(1, "A/S", dates[1].date),
    cell(1, "A", dates[2].date), cell(2, "D", dates[2].date),
    cell(1, "D", dates[3].date), cell(2, "D", dates[4].date),
  ];

  const ngPairViolations = getNgPairViolations(assignments, partners);
  assert.deepEqual(ngPairViolations, [
    { work_date: date, shift: "夜勤", staff_a_id: 1, staff_b_id: 2 },
    { work_date: dates[1].date, shift: "日勤", staff_a_id: 1, staff_b_id: 2 },
  ]);
  const issues = monthlyGenerationChecks({
    ngPairViolations, nightShortages: [], nightAfterConflicts: [], dayShortages: [], dayTeamShortages: [], warnings: [],
  });
  assert.deepEqual(issues.map(({ severity, validation_code, staff_id, related_staff_id, work_date }) =>
    [severity, validation_code, staff_id, related_staff_id, work_date]), [
    ["error", "E003", 1, 2, date],
    ["error", "E003", 1, 2, dates[1].date],
  ]);
});

test("31日間の夜勤・日勤を生成し、必要人数の充足とNGペア違反ゼロを確認する", () => {
  const staffs = Array.from({ length: 12 }, (_, i) => staff(i + 1, i % 2 === 0 ? "A" : "B"));
  const ngPairPartners = indexNgPairs([pair(2, 1), pair(3, 4), pair(6, 5)]);
  const fixedCells = [cell(1, "有")];
  const night = assignNightShifts({
    dates, staffs, fixedCells, existingAssignments: [],
    nightStaffCount: 2, nightShiftLimit: 6, nightShiftNextDayAfter: true, ngPairPartners,
  });
  const day = assignDayShifts({
    dates, staffs, existingAssignments: [],
    fixedCells: [...fixedCells, ...night.assignments, ...night.nightAfterFixedCells],
    requirements: { weekday: 4, saturday: 4, sunday: 4 },
    maxConsecutiveWorkDays: 5, ngPairPartners,
  });

  assert.equal(night.assignments.length, 62);
  assert.equal(day.assignments.length, 124);
  assert.deepEqual(getNgPairViolations([...night.assignments, ...day.assignments], ngPairPartners), []);
});
