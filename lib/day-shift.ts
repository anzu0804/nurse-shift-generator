import { staffDateKey } from "./fixed-leave.ts";
import { hasNgPairConflict, isNgPairDayShift, type NgPairPartners } from "./ng-pairs.ts";
import { offsetShiftDate } from "./night-after.ts";
import { DAY_SHIFT_CODE, dayShiftCodes, isWorkShift, type ShiftCell as WorkCell } from "./shift-work.ts";
import { countWeekendWork, weekendDates } from "./weekend-shift.ts";

type DayShiftStaff = {
  id: number;
  employment_status: string;
  is_active: boolean;
  job_type: string;
  display_order: number | null;
  team?: string | null;
  role?: string | null;
};

type ShiftCell = WorkCell & { team_assignment?: string | null };

type DayShiftRequirements = {
  weekday: number;
  saturday: number;
  sunday: number;
};

const dayShiftTeams = ["A", "B"] as const;
type DayShiftTeam = (typeof dayShiftTeams)[number];
type TeamCounts = Record<DayShiftTeam, number>;
type TeamShortage = { work_date: string; team: DayShiftTeam; missing_count: number };

function getDayShiftTeam(team: string | null | undefined): DayShiftTeam | undefined {
  if (team === "A" || team === "B") return team;
}

function isTeamLeader({ role }: DayShiftStaff) {
  return role === "主任" || role === "リーダー";
}

function selectTeamLeaders(
  candidates: readonly DayShiftStaff[],
  missingTeams: readonly DayShiftTeam[],
  availableSlots: number,
  ngPairPartners: NgPairPartners,
) {
  if (availableSlots === 0 || missingTeams.length === 0) return [];
  const leaders = candidates.filter((staff) => isTeamLeader(staff) && getDayShiftTeam(staff.team));
  const options = missingTeams.map((team) => leaders.map((staff) => ({
    staff,
    team,
    // Fill from the team first, preferring chiefs to leaders within that team.
    priority: (staff.team === team ? 0 : 3) + (staff.role === "主任" ? 0 : 1),
  })));
  const first = options.flat().sort((a, b) => a.priority - b.priority)[0];
  if (!first) return [];
  const [teamA, teamB] = options;
  if (availableSlots === 1 || !teamB) return [first];

  // Check both teams together so a preferred candidate cannot block the other team.
  let bestPair = [first];
  let bestPriority = Infinity;
  for (const a of teamA) {
    for (const b of teamB) {
      const priority = a.priority + b.priority;
      if (priority >= bestPriority || a.staff.id === b.staff.id ||
        ngPairPartners.get(a.staff.id)?.has(b.staff.id)) continue;
      bestPair = [a, b];
      bestPriority = priority;
    }
  }
  return bestPair;
}

export function isDayShiftStaff(staff: DayShiftStaff) {
  return staff.is_active && staff.employment_status === "在籍中" &&
    (staff.job_type === "正看護師" || staff.job_type === "補助看護師");
}

export function requiredDayShiftCount(weekday: number, requirements: DayShiftRequirements) {
  if (weekday === 6) return requirements.saturday;
  if (weekday === 0) return requirements.sunday;
  return requirements.weekday;
}

function staysWithinWorkLimit(
  staffId: number,
  date: string,
  cells: ReadonlyMap<string, ShiftCell>,
  maxConsecutiveWorkDays: number,
) {
  let workDays = 1;
  for (const direction of [-1, 1]) {
    let adjacentDate = offsetShiftDate(date, direction);
    while (adjacentDate && isWorkShift(cells.get(staffDateKey(staffId, adjacentDate)))) {
      workDays += 1;
      if (workDays > maxConsecutiveWorkDays) return false;
      adjacentDate = offsetShiftDate(adjacentDate, direction);
    }
  }

  return workDays <= maxConsecutiveWorkDays;
}

export function getConsecutiveWorkWarnings(
  dates: readonly { date: string }[],
  assignmentLayers: readonly (readonly ShiftCell[])[],
  limit: number,
) {
  const cells = new Map<string, ShiftCell>();
  for (const layer of assignmentLayers) {
    for (const cell of layer) cells.set(staffDateKey(cell.staff_id, cell.work_date), cell);
  }

  const month = new Set(dates.map(({ date }) => date));
  const warnings: { code: "W002"; staff_id: number; work_date: string; count: number; limit: number }[] = [];
  for (const cell of cells.values()) {
    if (!isWorkShift(cell)) continue;
    const { staff_id, work_date } = cell;
    const previous = offsetShiftDate(work_date, -1);
    if (previous && isWorkShift(cells.get(staffDateKey(staff_id, previous)))) continue;

    let count = 0;
    let firstDateInMonth: string | undefined;
    let date: string | undefined = work_date;
    while (date && isWorkShift(cells.get(staffDateKey(staff_id, date)))) {
      count += 1;
      if (month.has(date)) firstDateInMonth ??= date;
      date = offsetShiftDate(date, 1);
    }
    if (firstDateInMonth && count > limit) {
      warnings.push({ code: "W002", staff_id, work_date: firstDateInMonth, count, limit });
    }
  }
  return warnings;
}

export function getDayShiftCandidates(
  staffs: readonly DayShiftStaff[],
  date: string,
  cells: ReadonlyMap<string, ShiftCell>,
  maxConsecutiveWorkDays: number,
) {
  return staffs.filter((staff) =>
    isDayShiftStaff(staff) &&
    !cells.has(staffDateKey(staff.id, date)) &&
    staysWithinWorkLimit(staff.id, date, cells, maxConsecutiveWorkDays),
  );
}

function selectDayShiftCandidates(
  candidates: readonly DayShiftStaff[],
  availableSlots: number,
  teamNeeds: TeamCounts,
  conflictsWithAssignment: (staffId: number, selectedIds: ReadonlySet<number>) => boolean,
) {
  const remaining = { ...teamNeeds };
  const selected: DayShiftStaff[] = [];
  const selectedIds = new Set<number>();
  const otherCandidates: DayShiftStaff[] = [];
  for (const staff of candidates) {
    if (selected.length === availableSlots) break;
    const team = getDayShiftTeam(staff.team);
    if (team && remaining[team] > 0) {
      if (conflictsWithAssignment(staff.id, selectedIds)) continue;
      selected.push(staff);
      selectedIds.add(staff.id);
      remaining[team] -= 1;
    } else {
      otherCandidates.push(staff);
    }
  }
  for (const staff of otherCandidates) {
    if (selected.length === availableSlots) break;
    if (conflictsWithAssignment(staff.id, selectedIds)) continue;
    selected.push(staff);
    selectedIds.add(staff.id);
  }
  return selected;
}

export function assignDayShifts({
  dates,
  staffs,
  existingAssignments,
  fixedCells,
  requirements,
  maxConsecutiveWorkDays,
  balanceWeekendShifts = false,
  ngPairPartners = new Map(),
}: {
  dates: readonly { date: string; weekday: number }[];
  staffs: readonly DayShiftStaff[];
  existingAssignments: readonly ShiftCell[];
  fixedCells: readonly ShiftCell[];
  requirements: DayShiftRequirements;
  maxConsecutiveWorkDays: number;
  balanceWeekendShifts?: boolean;
  ngPairPartners?: NgPairPartners;
}) {
  const cells = new Map<string, ShiftCell>();
  for (const cell of [...existingAssignments, ...fixedCells]) {
    cells.set(staffDateKey(cell.staff_id, cell.work_date), cell);
  }

  const staffById = new Map(staffs.filter(isDayShiftStaff).map((staff) => [staff.id, staff]));
  const eligibleStaff = [...staffById.values()];
  const weekends = balanceWeekendShifts ? weekendDates(dates) : new Set<string>();
  const weekendCounts = balanceWeekendShifts ? countWeekendWork(weekends, existingAssignments, fixedCells) : new Map<number, number>();
  const month = new Set(dates.map(({ date }) => date));
  const workCounts = new Map<number, number>();
  for (const cell of cells.values()) {
    if (month.has(cell.work_date) && isWorkShift(cell)) {
      workCounts.set(cell.staff_id, (workCounts.get(cell.staff_id) ?? 0) + 1);
    }
  }

  const assignments: ShiftCell[] = [];
  const shortages: { work_date: string; missing_count: number }[] = [];
  const teamShortages: TeamShortage[] = [];
  const leadershipShortages: TeamShortage[] = [];

  for (const { date, weekday } of [...dates].sort((a, b) => a.date.localeCompare(b.date))) {
    const required = requiredDayShiftCount(weekday, requirements);
    const teamCounts: TeamCounts = { A: 0, B: 0 };
    const coveredTeams = new Set<DayShiftTeam>();
    let existingDayStaff = 0;
    for (const staff of eligibleStaff) {
      const cell = cells.get(staffDateKey(staff.id, date));
      if (!cell || !dayShiftCodes.has(cell.shift_code)) continue;
      existingDayStaff += 1;
      const team = getDayShiftTeam(cell.team_assignment) ?? getDayShiftTeam(staff.team);
      if (team) {
        teamCounts[team] += 1;
        if (isTeamLeader(staff)) coveredTeams.add(team);
      }
    }

    // The saved count is shared by both teams. An odd slot is open to either team.
    const minimumPerTeam = Math.floor(required / 2);
    const needed = Math.max(0, required - existingDayStaff);
    const balanceToday = weekends.has(date);
    const candidates = needed === 0 ? [] : getDayShiftCandidates(eligibleStaff, date, cells, maxConsecutiveWorkDays)
      .filter(({ id }) => !hasNgPairConflict(ngPairPartners, id, (partner) =>
        isNgPairDayShift(cells.get(staffDateKey(partner, date))?.shift_code),
      ))
      .sort((a, b) =>
        (balanceToday ? (weekendCounts.get(a.id) ?? 0) - (weekendCounts.get(b.id) ?? 0) : 0) ||
        (workCounts.get(a.id) ?? 0) - (workCounts.get(b.id) ?? 0) ||
        (a.display_order ?? 0) - (b.display_order ?? 0) ||
        a.id - b.id,
      );
    const selectedLeaders = selectTeamLeaders(
      candidates, dayShiftTeams.filter((team) => !coveredTeams.has(team)), needed, ngPairPartners,
    );
    const leaderIds = new Set(selectedLeaders.map(({ staff }) => staff.id));
    for (const { team } of selectedLeaders) {
      coveredTeams.add(team);
      teamCounts[team] += 1;
    }
    const remainingCandidates = candidates.filter(({ id }) =>
      !leaderIds.has(id) && !hasNgPairConflict(ngPairPartners, id, (partner) => leaderIds.has(partner)),
    );
    const selected = selectDayShiftCandidates(remainingCandidates, needed - selectedLeaders.length, {
      A: minimumPerTeam - teamCounts.A,
      B: minimumPerTeam - teamCounts.B,
    }, (staffId, selectedIds) => hasNgPairConflict(ngPairPartners, staffId, (partner) => selectedIds.has(partner)));
    const selections = [
      ...selectedLeaders,
      ...selected.map((staff) => ({ staff, team: getDayShiftTeam(staff.team) })),
    ];
    for (const { staff, team } of selections) {
      const { id } = staff;
      const assignment = {
        staff_id: id, work_date: date, shift_code: DAY_SHIFT_CODE,
        ...(team && team !== staff.team ? { team_assignment: team } : {}),
      };
      cells.set(staffDateKey(id, date), assignment);
      assignments.push(assignment);
      workCounts.set(id, (workCounts.get(id) ?? 0) + 1);
      if (balanceToday) weekendCounts.set(id, (weekendCounts.get(id) ?? 0) + 1);
      if (team && !leaderIds.has(id)) teamCounts[team] += 1;
    }

    if (selections.length < needed) {
      shortages.push({ work_date: date, missing_count: needed - selections.length });
    }
    for (const team of dayShiftTeams) {
      const missing = minimumPerTeam - teamCounts[team];
      if (missing > 0) teamShortages.push({ work_date: date, team, missing_count: missing });
      if (!coveredTeams.has(team)) leadershipShortages.push({ work_date: date, team, missing_count: 1 });
    }
  }

  return { assignments, shortages, teamShortages, leadershipShortages };
}
