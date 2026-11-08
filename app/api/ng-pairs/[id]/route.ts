import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// 1件取得
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("ng_pairs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// 更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const errorResponse = (message: string, status: number) => {
    return NextResponse.json(
      { error: message },
      { status }
    );
  };

  // IDが正の整数か確認する
  const parseId = (value: unknown): number | null => {
    if (typeof value !== "number" && typeof value !== "string") {
      return null;
    }

    if (!/^[1-9]\d*$/.test(String(value))) {
      return null;
    }

    const number = Number(value);

    return Number.isSafeInteger(number) ? number : null;
  };

  const { id } = await params;
  const pairId = parseId(id);

  if (pairId === null) {
    return errorResponse("NGペアIDが正しくありません。", 400);
  }

  // JSONとして読み取れるか確認する
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return errorResponse("送信されたデータの形式が正しくありません。", 400);
  }

  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    return errorResponse("送信されたデータの形式が正しくありません。", 400);
  }

  const body = payload as Record<string, unknown>;

  const firstStaffId = parseId(body.staff_a_id);
  const secondStaffId = parseId(body.staff_b_id);

  if (firstStaffId === null || secondStaffId === null) {
    return errorResponse(
      "スタッフAとスタッフBを選択してください。",
      400
    );
  }

  if (firstStaffId === secondStaffId) {
    return errorResponse(
      "同じスタッフ同士はNGペアに登録できません。",
      400
    );
  }

  if (
    body.reason !== undefined &&
    body.reason !== null &&
    typeof body.reason !== "string"
  ) {
    return errorResponse("理由は文字列で入力してください。", 400);
  }

  if (
    body.is_active !== undefined &&
    typeof body.is_active !== "boolean"
  ) {
    return errorResponse("有効・無効の指定が正しくありません。", 400);
  }

  // DBの制約に合わせて、小さいIDをA、大きいIDをBにする
  const staffAId = Math.min(firstStaffId, secondStaffId);
  const staffBId = Math.max(firstStaffId, secondStaffId);

  try {
    // 編集中のレコード自身は、重複チェックから除外する
    const { data: duplicate, error: checkError } = await supabase
      .from("ng_pairs")
      .select("id")
      .eq("staff_a_id", staffAId)
      .eq("staff_b_id", staffBId)
      .neq("id", pairId)
      .maybeSingle();

    if (checkError) {
      console.error("NGペア重複確認エラー:", checkError.code);

      return errorResponse(
        "重複確認に失敗しました。時間をおいて再度お試しください。",
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
      .update({
        staff_a_id: staffAId,
        staff_b_id: staffBId,

        // 送信された項目だけ更新する
        ...(body.reason !== undefined
          ? {
              reason:
                typeof body.reason === "string"
                  ? body.reason.trim() || null
                  : null,
            }
          : {}),

        ...(typeof body.is_active === "boolean"
          ? { is_active: body.is_active }
          : {}),
      })
      .eq("id", pairId)
      .select()
      .maybeSingle();

    if (error) {
      // 同時操作などで、事前確認後に重複が発生した場合
      if (error.code === "23505") {
        return errorResponse(
          "このNGペアはすでに登録されています。",
          409
        );
      }

      if (error.code === "23503") {
        return errorResponse(
          "選択したスタッフが見つかりません。一覧を更新してください。",
          422
        );
      }

      if (error.code === "42501") {
        return errorResponse(
          "更新権限がありません。アクセス権限を確認してください。",
          403
        );
      }

      if (error.code === "23514") {
        return errorResponse(
          "登録条件に合わない内容です。選択したスタッフを確認してください。",
          422
        );
      }

      console.error("NGペア更新エラー:", error.code);

      return errorResponse("NGペアの更新に失敗しました。", 500);
    }

    if (!data) {
      return errorResponse(
        "更新対象のNGペアが見つからないか、更新権限がありません。",
        404
      );
    }

    return NextResponse.json(data);
  } catch {
    return errorResponse(
      "更新処理に失敗しました。通信状態を確認して再度お試しください。",
      500
    );
  }
}

// 削除
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  const { error } = await supabase
    .from("ng_pairs")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "NGペアを削除しました",
  });
}