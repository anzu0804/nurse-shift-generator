const LEAVE_TYPES = [
  "有給",
  "生理休暇",
  "夏休み",
  "誕生日",
] as const;

const STATUSES = [
  "申請済み",
  "確定",
  "取消",
] as const;

type LeaveInput = {
  staff_id: number;
  leave_date: string;
  leave_type: (typeof LEAVE_TYPES)[number];
  status: (typeof STATUSES)[number];
  note: string | null;
};

type ValidationResult =
  | { ok: true; data: LeaveInput }
  | { ok: false; error: string };

// IDが正の整数か確認する
export function parsePositiveId(value: unknown): number | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  if (!/^[1-9]\d*$/.test(String(value))) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) ? id : null;
}

// 登録・更新で共通の入力チェック
export function validateLeaveRequest(
  value: unknown,
  mode: "create" | "update"
): ValidationResult {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {
      ok: false,
      error: "送信データの形式が正しくありません。",
    };
  }

  const body = value as Record<string, unknown>;
  const staffId = parsePositiveId(body.staff_id);

  if (staffId === null) {
    return {
      ok: false,
      error: "スタッフを選択してください。",
    };
  }

  const date =
    typeof body.leave_date === "string"
      ? body.leave_date.trim()
      : "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return {
      ok: false,
      error: "希望日をYYYY-MM-DD形式で入力してください。",
    };
  }

  // 2月30日など、存在しない日付も拒否する
  const year = Number(date.slice(0, 4));
  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    year < 100 ||
    year > 9998 ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    return {
      ok: false,
      error: "存在する日付を入力してください（0100～9998年）。",
    };
  }

  const leaveType = LEAVE_TYPES.find(
    (type) => type === body.leave_type
  );

  if (!leaveType) {
    return {
      ok: false,
      error: "休暇種別を選択してください。",
    };
  }

  // 新規登録で状態が省略された場合のみ「申請済み」にする
  const statusValue =
    mode === "create" && body.status === undefined
      ? "申請済み"
      : body.status;

  const status = STATUSES.find(
    (item) => item === statusValue
  );

  if (!status) {
    return {
      ok: false,
      error: "状態は申請済み・確定・取消から選択してください。",
    };
  }

  if (
    body.note != null &&
    typeof body.note !== "string"
  ) {
    return {
      ok: false,
      error: "備考は文字列で入力してください。",
    };
  }

  return {
    ok: true,
    data: {
      staff_id: staffId,
      leave_date: date,
      leave_type: leaveType,
      status,
      note:
        typeof body.note === "string"
          ? body.note.trim() || null
          : null,
    },
  };
}

// DBエラーを画面向けの日本語に変換する
export function getLeaveDbError(code: string): {
  status: number;
  message: string;
} {
  switch (code) {
    case "23505":
  return {
    status: 409,
    message:
      "このスタッフの同じ日付に、申請済みまたは確定の希望休があります。休暇種別にかかわらず1日1件までです。既存の申請を編集するか、取消にしてから登録してください。",
  };

    case "23503":
      return {
        status: 422,
        message:
          "選択したスタッフが見つかりません。一覧を再読み込みしてください。",
      };

    case "42501":
      return {
        status: 403,
        message:
          "保存権限がありません。アクセス権限を確認してください。",
      };

    case "23502":
    case "23514":
    case "22007":
    case "22008":
      return {
        status: 422,
        message:
          "入力内容がデータベースの登録条件に合っていません。",
      };

    default:
      return {
        status: 500,
        message:
          "希望休を保存できませんでした。接続状態を確認してください。",
      };
  }
}