import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ログインしたユーザーの権限で会議一覧を取得する
export async function GET(request: Request) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization",
      },
    });

  // ブラウザから送られたログイン情報を受け取る
  const authorization = request.headers.get("Authorization");
  const match = authorization?.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return reply(
      { error: "ログインが必要です。" },
      401
    );
  }

  const token = match[1];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return reply(
      { error: "サーバーの接続設定が不足しています。" },
      500
    );
  }

  try {
    // リクエストごとに認証確認用のクライアントを作る。
    // サーバーにユーザーのセッションを保存しない。
    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    // 受け取った情報を信用するだけでなく、
    // Supabaseの認証サーバーで確認する
    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError) {
      const authStatus = authError.status ?? 0;

      if (authStatus === 0 || authStatus >= 500) {
        return reply(
          {
            error:
              "認証サーバーに接続できませんでした。少し時間をおいて再読み込みしてください。",
          },
          503
        );
      }

      return reply(
        {
          error:
            "ログイン情報を確認できません。ログインし直してください。",
        },
        401
      );
    }

    if (!authData.user || authData.user.is_anonymous) {
      return reply(
        { error: "登録済みのアカウントでログインしてください。" },
        401
      );
    }

    // 確認済みのユーザーのトークンでDBに接続する。
    // service_roleキーは使わず、設定済みのRLSを適用する。
    const userClient = createClient(url, anonKey, {
      accessToken: async () => token,
    });

    const { data, error } = await userClient
      .from("meetings")
      .select("*")
      .order("meeting_date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "会議を閲覧する権限がありません。管理者の権限設定を確認してください。",
          },
          403
        );
      }

      return reply(
        {
          error:
            "会議一覧を取得できませんでした。接続状態を確認してください。",
        },
        500
      );
    }

    return reply(data ?? []);
  } catch {
    return reply(
      {
        error:
          "会議一覧の取得中に通信エラーが発生しました。",
      },
      503
    );
  }
}

// 会議と担当スタッフをまとめて登録する
export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "Authorization",
      },
    });

  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) {
    return reply({ error: "ログインが必要です。" }, 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return reply(
      { error: "サーバーの接続設定が不足しています。" },
      500
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return reply(
      { error: "送信データの形式が正しくありません。" },
      400
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return reply(
      { error: "送信データの形式が正しくありません。" },
      400
    );
  }

  const body = payload as Record<string, unknown>;

  const name =
    typeof body.meeting_name === "string"
      ? body.meeting_name.trim()
      : "";

  if (!name || name.length > 100) {
    return reply(
      { error: "会議名を1～100文字で入力してください。" },
      400
    );
  }

  // 任意入力の文字列項目を確認する
  const textFields = [
    "meeting_date",
    "time_period",
    "recurrence_type",
    "recurrence_rule",
  ];

  if (
    textFields.some(
      (field) =>
        body[field] != null &&
        typeof body[field] !== "string"
    )
  ) {
    return reply(
      { error: "日付・時間帯・繰り返しの入力形式が正しくありません。" },
      400
    );
  }

  const date =
    typeof body.meeting_date === "string"
      ? body.meeting_date.trim() || null
      : null;

  const timePeriod =
    typeof body.time_period === "string"
      ? body.time_period.trim() || null
      : null;

  const recurrenceType =
    typeof body.recurrence_type === "string"
      ? body.recurrence_type.trim() || "なし"
      : "なし";

  const recurrenceRule =
    typeof body.recurrence_rule === "string"
      ? body.recurrence_rule.trim() || null
      : null;

  if (!["なし", "毎週", "毎月"].includes(recurrenceType)) {
    return reply(
      { error: "繰り返しは「なし・毎週・毎月」から選択してください。" },
      400
    );
  }

  if (
    timePeriod !== null &&
    !["AM", "PM", "終日"].includes(timePeriod)
  ) {
    return reply(
      { error: "時間帯は「AM・PM・終日」から選択してください。" },
      400
    );
  }

  if (recurrenceType === "なし" && !date) {
    return reply(
      { error: "繰り返しが「なし」の場合は、開催日を入力してください。" },
      400
    );
  }

  if (date !== null) {
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    const year = Number(date.slice(0, 4));

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      year < 100 ||
      year > 9998 ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.toISOString().slice(0, 10) !== date
    ) {
      return reply(
        { error: "存在する開催日を入力してください。" },
        400
      );
    }
  }

  if (typeof body.is_active !== "boolean") {
    return reply(
      { error: "有効・無効の指定が正しくありません。" },
      400
    );
  }

  // 担当者なしの場合も、空配列 [] を明示的に受け取る
  if (
    !Array.isArray(body.staff_ids) ||
    !body.staff_ids.every(
      (id: unknown) =>
        typeof id === "number" &&
        Number.isSafeInteger(id) &&
        id > 0
    )
  ) {
    return reply(
      { error: "担当スタッフの選択内容が正しくありません。" },
      400
    );
  }

  const staffIds = [...new Set(body.staff_ids)];

  try {
    // ログイン情報を認証サーバーで確認する
    const authClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: authData, error: authError } =
      await authClient.auth.getUser(token);

    if (authError) {
      const status = authError.status ?? 0;

      if (status === 429) {
        return reply(
          { error: "認証の試行回数が多いため、少し時間をおいてください。" },
          429
        );
      }

      if (status === 0 || status >= 500) {
        return reply(
          { error: "認証サーバーに接続できませんでした。" },
          503
        );
      }

      return reply(
        { error: "ログイン情報を確認できません。ログインし直してください。" },
        401
      );
    }

    if (!authData.user || authData.user.is_anonymous) {
      return reply(
        { error: "登録済みのアカウントでログインしてください。" },
        401
      );
    }

    // このユーザーの権限で、保存用のDB関数を呼ぶ
    const userClient = createClient(url, anonKey, {
      accessToken: async () => token,
    });

    const { data, error } = await userClient.rpc(
      "save_meeting_with_staffs",
      {
        p_meeting_name: name,
        p_meeting_date: date,
        p_time_period: timePeriod,
        p_recurrence_type: recurrenceType,
        p_recurrence_rule: recurrenceRule,
        p_is_active: body.is_active,
        p_staff_ids: staffIds,

        // 新規登録なので会議IDは指定しない
        p_meeting_id: null,
      }
    );

    if (error) {
      const messages: Record<string, [number, string]> = {
        "42501": [
          403,
          "保存権限がありません。管理者のUIDと権限設定を確認してください。",
        ],
        "23503": [
          422,
          "選択したスタッフが見つかりません。画面を再読み込みしてください。",
        ],
        "23505": [
          409,
          "登録内容が既存データと重複しています。",
        ],
        "23514": [
          422,
          "会議の登録条件に合っていません。開催日・時間帯・繰り返しを確認してください。",
        ],
        "22023": [
          400,
          "入力内容が正しくありません。会議名と担当スタッフを確認してください。",
        ],
        PGRST202: [
          500,
          "保存用のDB関数が見つかりません。関数名と引数の設定を確認してください。",
        ],
      };

      const [status, message] = messages[error.code] ?? [
        500,
        "保存結果を確認できませんでした。再登録する前に、会議一覧を確認してください。",
      ];

      return reply({ error: message }, status);
    }

    if (
      !data ||
      typeof data !== "object" ||
      !Number.isSafeInteger(data.id) ||
      !Array.isArray(data.staff_ids)
    ) {
      return reply(
        {
          error:
            "保存結果の形式を確認できませんでした。再登録する前に、会議一覧を確認してください。",
        },
        500
      );
    }

    return reply(data, 201);
  } catch {
    return reply(
      {
        error:
          "通信に失敗しました。登録済みの可能性があるため、再登録する前に会議一覧を確認してください。",
      },
      503
    );
  }
}