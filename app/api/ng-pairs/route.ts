import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

function parseId(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  if (!/^[1-9]\d*$/.test(String(value))) {
    return null;
  }

  const id = Number(value);

  return Number.isSafeInteger(id) ? id : null;
}

export async function GET(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("ng_pairs")
      .select("*")
      .order("id");

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "NGペアを閲覧する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "NGペア一覧を取得できませんでした。" },
        500
      );
    }

    return reply(data ?? []);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "NGペア一覧の取得中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

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

    const firstId = parseId(body.staff_a_id);
    const secondId = parseId(body.staff_b_id);

    if (firstId === null || secondId === null) {
      return reply(
        { error: "スタッフAとスタッフBを選択してください。" },
        400
      );
    }

    if (firstId === secondId) {
      return reply(
        { error: "同じスタッフ同士はNGペアに登録できません。" },
        400
      );
    }

    if (
      body.reason !== undefined &&
      body.reason !== null &&
      typeof body.reason !== "string"
    ) {
      return reply(
        { error: "理由は文字列で入力してください。" },
        400
      );
    }

    if (
      body.is_active !== undefined &&
      typeof body.is_active !== "boolean"
    ) {
      return reply(
        { error: "有効・無効の指定が正しくありません。" },
        400
      );
    }

    const staffAId = Math.min(firstId, secondId);
    const staffBId = Math.max(firstId, secondId);

    const { data: duplicate, error: checkError } =
      await supabase
        .from("ng_pairs")
        .select("id")
        .or(
          `and(staff_a_id.eq.${staffAId},staff_b_id.eq.${staffBId}),and(staff_a_id.eq.${staffBId},staff_b_id.eq.${staffAId})`
        )
        .limit(1)
        .maybeSingle();

    if (checkError) {
      if (checkError.code === "42501") {
        return reply(
          { error: "NGペアを確認する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "NGペアの重複確認に失敗しました。" },
        500
      );
    }

    if (duplicate) {
      return reply(
        {
          error:
            "このNGペアはすでに登録されています。無効な登録も確認してください。",
        },
        409
      );
    }

    const { data, error } = await supabase
      .from("ng_pairs")
      .insert({
        staff_a_id: staffAId,
        staff_b_id: staffBId,
        reason:
          typeof body.reason === "string"
            ? body.reason.trim() || null
            : null,
        is_active:
          typeof body.is_active === "boolean"
            ? body.is_active
            : true,
      })
      .select()
      .maybeSingle();

    if (error) {
      const errors: Record<string, [number, string]> = {
        "23505": [
          409,
          "このNGペアはすでに登録されています。",
        ],
        "23503": [
          422,
          "選択したスタッフが見つかりません。",
        ],
        "23514": [
          422,
          "登録条件に合わない内容です。",
        ],
        "42501": [
          403,
          "NGペアを登録する権限がありません。",
        ],
      };

      const [status, message] = errors[error.code] ?? [
        500,
        "NGペアの登録に失敗しました。",
      ];

      return reply({ error: message }, status);
    }

    if (!data) {
      return reply(
        { error: "登録結果を確認できませんでした。" },
        500
      );
    }

    return reply(data, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "NGペア登録中に通信エラーが発生しました。" },
      503
    );
  }
}