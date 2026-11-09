import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Params = {
  params: Promise<{ id: string }>;
};

class ApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

function failure(error: unknown) {
  if (error instanceof ApiError) {
    return reply({ error: error.message }, error.status);
  }

  return reply(
    {
      error:
        "通信結果を確認できません。一覧を再読み込みして確認してください。",
    },
    503
  );
}

function parseId(value: string): number {
  const id = Number(value);

  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(id)
  ) {
    throw new ApiError("会議IDが正しくありません。");
  }

  return id;
}

// ログイン情報を確認し、そのユーザーの権限でDBに接続する
async function userDb(request: Request) {
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) {
    throw new ApiError("ログインが必要です。", 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new ApiError("接続設定が不足しています。", 500);
  }

  const authClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await authClient.auth.getUser(token);

  if (error) {
    const status = error.status ?? 0;

    if (status === 429) {
      throw new ApiError(
        "少し時間をおいて再度お試しください。",
        429
      );
    }

    if (status === 0 || status >= 500) {
      throw new ApiError(
        "認証サーバーに接続できません。",
        503
      );
    }

    throw new ApiError("ログインし直してください。", 401);
  }

  if (!data.user || data.user.is_anonymous) {
    throw new ApiError("ログインが必要です。", 401);
  }

  return createClient(url, key, {
    accessToken: async () => token,
  });
}

function dbError(code: string): ApiError {
  const messages: Record<string, [number, string]> = {
    "42501": [
      403,
      "操作権限がありません。管理者のUIDと権限設定を確認してください。",
    ],
    "23503": [
      409,
      "参照先のスタッフ、または関連データを確認してください。",
    ],
    "23505": [
      409,
      "登録内容が既存データと重複しています。",
    ],
    "23514": [
      422,
      "開催日・時間帯・繰り返しの登録条件を確認してください。",
    ],
    "22023": [
      400,
      "入力内容が正しくありません。",
    ],
    P0002: [
      404,
      "会議が見つからないか、操作権限がありません。",
    ],
    PGRST202: [
      500,
      "保存用のDB関数が見つかりません。",
    ],
    PGRST301: [
      401,
      "ログインし直してください。",
    ],
  };

  const [status, message] = messages[code] ?? [
    500,
    "処理結果を確認できません。一覧を再読み込みしてください。",
  ];

  return new ApiError(message, status);
}

// 会議情報と担当スタッフを一緒に取得する
export async function GET(
  request: Request,
  { params }: Params
) {
  try {
    const id = parseId((await params).id);
    const db = await userDb(request);

    const { data, error } = await db
      .from("meetings")
      .select("*, meeting_staffs(staff_id)")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw dbError(error.code);
    }

    if (!data) {
      throw new ApiError(
        "会議が見つからないか、閲覧権限がありません。",
        404
      );
    }

    const { meeting_staffs, ...meeting } = data;

    if (!Array.isArray(meeting_staffs)) {
      throw new ApiError(
        "担当スタッフの取得結果を確認できません。",
        500
      );
    }

    return reply({
      ...meeting,
      staff_ids: meeting_staffs.map(
        (row: { staff_id: number }) => row.staff_id
      ),
    });
  } catch (error) {
    return failure(error);
  }
}

// 会議情報と担当スタッフをまとめて更新する
export async function PUT(
  request: Request,
  { params }: Params
) {
  try {
    const id = parseId((await params).id);
    const db = await userDb(request);

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      throw new ApiError(
        "送信データの形式が正しくありません。"
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      throw new ApiError(
        "送信データの形式が正しくありません。"
      );
    }

    const body = payload as Record<string, unknown>;

    const name =
      typeof body.meeting_name === "string"
        ? body.meeting_name.trim()
        : "";

    if (!name || Array.from(name).length > 100) {
      throw new ApiError(
        "会議名を1～100文字で入力してください。"
      );
    }

    const text = (field: string): string | null => {
      const value = body[field];

      if (value == null || value === "") {
        return null;
      }

      if (typeof value !== "string") {
        throw new ApiError(
          "日付・時間帯・繰り返しの形式が正しくありません。"
        );
      }

      return value.trim() || null;
    };

    const date = text("meeting_date");
    const period = text("time_period");
    const repeat = text("recurrence_type") ?? "なし";
    const rule = text("recurrence_rule");

    if (!["なし", "毎週", "毎月"].includes(repeat)) {
      throw new ApiError(
        "繰り返しの選択を確認してください。"
      );
    }

    if (
      period !== null &&
      !["AM", "PM", "終日"].includes(period)
    ) {
      throw new ApiError("時間帯の選択を確認してください。");
    }

    if (repeat === "なし" && !date) {
      throw new ApiError("開催日を入力してください。");
    }

    if (date) {
      const parsed = new Date(`${date}T00:00:00.000Z`);
      const year = Number(date.slice(0, 4));

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        year < 100 ||
        year > 9998 ||
        Number.isNaN(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date
      ) {
        throw new ApiError(
          "存在する開催日を入力してください。"
        );
      }
    }

    if (typeof body.is_active !== "boolean") {
      throw new ApiError("有効・無効を指定してください。");
    }

    // 担当者なしの場合も、空配列 [] を明示的に受け取る
    if (
      !Array.isArray(body.staff_ids) ||
      !body.staff_ids.every(
        (value: unknown) =>
          typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value > 0
      )
    ) {
      throw new ApiError(
        "担当スタッフの選択内容が正しくありません。"
      );
    }

    const { data, error } = await db.rpc(
      "save_meeting_with_staffs",
      {
        // 編集なので、対象の会議IDを渡す
        p_meeting_id: id,
        p_meeting_name: name,
        p_meeting_date: date,
        p_time_period: period,
        p_recurrence_type: repeat,
        p_recurrence_rule: rule,
        p_is_active: body.is_active,
        p_staff_ids: [...new Set(body.staff_ids)],
      }
    );

    if (error) {
      throw dbError(error.code);
    }

    if (
      !data ||
      data.id !== id ||
      !Array.isArray(data.staff_ids)
    ) {
      throw new ApiError(
        "保存結果を確認できません。再更新前に一覧を確認してください。",
        500
      );
    }

    return reply(data);
  } catch (error) {
    return failure(error);
  }
}

// 削除も、ログインしたユーザーの権限で実行する
export async function DELETE(
  request: Request,
  { params }: Params
) {
  try {
    const id = parseId((await params).id);
    const db = await userDb(request);

    const { data, error } = await db
      .from("meetings")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      throw dbError(error.code);
    }

    if (!data) {
      throw new ApiError(
        "会議が削除済みか、削除権限がありません。",
        404
      );
    }

    return reply({
      message: "会議を削除しました。",
      deleted_id: data.id,
    });
  } catch (error) {
    return failure(error);
  }
}