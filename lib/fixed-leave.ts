export const ACTIVE_LEAVE_STATUSES = ["申請済み", "確定"] as const;

const leaveCodes = new Map<string, string>([
  ["有給", "有"],
  ["生理休暇", "生"],
  ["夏休み", "公"],
  ["誕生日", "公"],
  ["誕生日休暇", "公"],
]);

type LeaveRequest = {
  staff_id: number;
  leave_date: string;
  leave_type: string;
  status: string;
};

type FixedLeaveCell = {
  staff_id: number;
  work_date: string;
  shift_code: string;
  leave_type: string;
};

export function leaveShiftCode(leaveType: string) {
  return leaveCodes.get(leaveType);
}

export function staffDateKey(staffId: number, date: string) {
  return staffId + "/" + date;
}

export class FixedLeaveValidationError extends Error {}

export function prepareFixedLeaves(
  dates: readonly { date: string }[],
  leaves: readonly LeaveRequest[],
) {
  const month = new Set(dates.map(({ date }) => date));
  const fixedLeaves = new Map<string, FixedLeaveCell>();

  for (const leave of leaves) {
    if (!ACTIVE_LEAVE_STATUSES.some((status) => status === leave.status)) continue;

    const { staff_id, leave_date, leave_type } = leave;
    const location = `${leave_date}（スタッフID ${staff_id}）`;
    if (!month.has(leave_date)) {
      throw new FixedLeaveValidationError(`対象月外の希望休があります。 ${location}`);
    }

    const key = staffDateKey(staff_id, leave_date);
    if (fixedLeaves.has(key)) {
      throw new FixedLeaveValidationError(
        `申請済み・確定の希望休が重複しています。希望休を確認してください。 ${location}`,
      );
    }

    const shiftCode = leaveShiftCode(leave_type);
    if (shiftCode === undefined) {
      throw new FixedLeaveValidationError(`未対応の休暇種別があります。 ${location}`);
    }
    fixedLeaves.set(key, { staff_id, work_date: leave_date, shift_code: shiftCode, leave_type });
  }

  return {
    fixedCells: [...fixedLeaves.values()],
    isLeaveFixed: (staffId: number, date: string) => fixedLeaves.has(staffDateKey(staffId, date)),
  };
}
