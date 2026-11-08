import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("ng_pairs")
    .select("*")
    .order("id");

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const errorResponse = (message: string, status: number) =>
    NextResponse.json({ error: message }, { status });

  // スタッフIDが正の整数か確認
  const parseId = (value: unknown): number | null => {
    if (typeof value !== "string" && typeof value !== "number") {
      return null;
    }

    if (!/^[1-9]\d*$/.test(String(value))) {
      return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
  };

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse(
      "送信データの形式が正しくありません。",
      400
    );
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return errorResponse(
      "送信データの形式が正しくありません。",
      400
    );
  }

  const body = payload as Record<string, unknown>;

  const firstId = parseId(body.staff_a_id);
  const secondId = parseId(body.staff_b_id);

  if (firstId === null || secondId === null) {
    return errorResponse(
      "スタッフAとスタッフBを選択してください。",
      400
    );
  }

  if (firstId === secondId) {
    return errorResponse(
      "同じスタッフ同士はNGペアに登録できません。",
      400
    );
  }

  if (body.reason != null && typeof body.reason !== "string") {
    return errorResponse(
      "理由は文字列で入力してください。",
      400
    );
  }

  if (
    body.is_active !== undefined &&
    typeof body.is_active !== "boolean"
  ) {
    return errorResponse(
      "有効・無効の指定が正しくありません。",
      400
    );
  }

  // 今後の保存順を統一する
  // すでに保存されているデータは書き換えない
  const staffAId = Math.min(firstId, secondId);
  const staffBId = Math.max(firstId, secondId);

  try {
    // A-B・B-Aの両方を確認する
    // 無効になっているNGペアも重複チェックに含める
    const { data: duplicate, error: checkError } = await supabase
      .from("ng_pairs")
      .select("id")
      .or(
        `and(staff_a_id.eq.${staffAId},staff_b_id.eq.${staffBId}),and(staff_a_id.eq.${staffBId},staff_b_id.eq.${staffAId})`
      )
      .limit(1)
      .maybeSingle();

    if (checkError) {
      return errorResponse(
        "NGペアの重複確認に失敗しました。",
        500
      );
    }

    if (duplicate) {
      return errorResponse(
        "このNGペアはすでに登録されています。無効な登録も確認してください。",
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
        is_active: body.is_active ?? true,
      })
      .select()
      .single();

    if (error) {
      const errors: Record<string, [string, number]> = {
        "23505": [
          "このNGペアはすでに登録されています。",
          409,
        ],
        "23503": [
          "選択したスタッフが見つかりません。",
          422,
        ],
        "23514": [
          "登録条件に合わない内容です。",
          422,
        ],
        "42501": [
          "登録権限がありません。アクセス権限を確認してください。",
          403,
        ],
      };

      const [message, status] = errors[error.code] ?? [
        "NGペアの登録に失敗しました。",
        500,
      ];

      return errorResponse(message, status);
    }

    if (!data) {
      return errorResponse(
        "登録結果を確認できませんでした。",
        500
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return errorResponse(
      "通信に失敗しました。接続状態を確認してください。",
      500
    );
  }
}