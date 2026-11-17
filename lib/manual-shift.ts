export const manualShiftAmounts = new Map<string, number | null>([
  ["A/S", 1], ["A", 1], ["D", 1], ["明", 0], ["前", 0], ["公", 0],
  ["生", 0], ["有", 0], ["JO", 1], ["JA", 1], ["A/カ", 0.5], ["A/ケ", 0.5],
  ["A/コ", 0.5], ["コ/カ", 0], ["マ/コ", 0], ["A/管", null], ["ア/管", 0],
  ["研修", null], ["会議", 0],
]);

export type EditableShift = {
  shift_code: string;
  team_assignment: string | null;
  assignment_role: string | null;
  work_amount: number;
  note: string | null;
};

const fields = {
  shiftCode: "shift_code",
  teamAssignment: "team_assignment",
  assignmentRole: "assignment_role",
  workAmount: "work_amount",
  note: "note",
} as const;

export function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function parseManualEdit(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { version, ...input } = body as Record<string, unknown>;
  if (!positiveInteger(version) || version >= 2147483647) return null;

  const changes: Partial<EditableShift> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!Object.hasOwn(fields, key)) return null;
    if (key === "workAmount") {
      if (typeof value !== "number" || value < 0 || value > 99.9 || !Number.isInteger(value * 10)) return null;
      changes.work_amount = value;
    } else {
      if (value !== null && (typeof value !== "string" || value.includes("\0"))) return null;
      const normalized = typeof value === "string" ? value.trim() || null : null;
      switch (key) {
        case "shiftCode":
          if (!normalized || normalized.length > 20) return null;
          changes.shift_code = normalized;
          break;
        case "teamAssignment":
          if (normalized && !["A", "B", "フリー"].includes(normalized)) return null;
          changes.team_assignment = normalized;
          break;
        case "assignmentRole":
          if (normalized && normalized.length > 50) return null;
          changes.assignment_role = normalized;
          break;
        case "note":
          if (normalized && normalized.length > 2000) return null;
          changes.note = normalized;
          break;
      }
    }
  }
  return Object.keys(changes).length ? { version, changes } : null;
}
