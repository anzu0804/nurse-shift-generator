import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "NGペアIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("ng_pairs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "NGペアを閲覧する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "NGペア情報を取得できませんでした。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "NGペアが見つかりません。" },
        404
      );
    }

    return reply(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "NGペア情報の取得中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  try {
    const pairId = parseId((await params).id);

    if (pairId === null) {
      return reply(
        { error: "NGペアIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    let payload: unknown;

    try {
      payload = await request.json();
    } catch {
      return reply(
        { error: "送信されたデータの形式が正しくありません。" },
        400
      );
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      Array.isArray(payload)
    ) {
      return reply(
        { error: "送信されたデータの形式が正しくありません。" },
        400
      );
    }

    const body = payload as Record<string, unknown>;

    const firstStaffId = parseId(body.staff_a_id);
    const secondStaffId = parseId(body.staff_b_id);

    if (firstStaffId === null || secondStaffId === null) {
      return reply(
        { error: "スタッフAとスタッフBを選択してください。" },
        400
      );
    }

    if (firstStaffId === secondStaffId) {
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

    const staffAId = Math.min(
      firstStaffId,
      secondStaffId
    );
    const staffBId = Math.max(
      firstStaffId,
      secondStaffId
    );

    const { data: duplicate, error: checkError } =
      await supabase
        .from("ng_pairs")
        .select("id")
        .or(
          `and(staff_a_id.eq.${staffAId},staff_b_id.eq.${staffBId}),and(staff_a_id.eq.${staffBId},staff_b_id.eq.${staffAId})`
        )
        .neq("id", pairId)
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
        { error: "重複確認に失敗しました。" },
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
      .update({
        staff_a_id: staffAId,
        staff_b_id: staffBId,

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
          "NGペアを更新する権限がありません。",
        ],
      };

      const [status, message] = errors[error.code] ?? [
        500,
        "NGペアの更新に失敗しました。",
      ];

      return reply({ error: message }, status);
    }

    if (!data) {
      return reply(
        {
          error:
            "更新対象のNGペアが見つからないか、更新権限がありません。",
        },
        404
      );
    }

    return reply(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "NGペア更新中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "NGペアIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("ng_pairs")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "NGペアを削除する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "NGペアの削除に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "削除対象のNGペアが見つからないか、削除権限がありません。",
        },
        404
      );
    }

    return reply({
      message: "NGペアを削除しました。",
      deleted_id: data.id,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "NGペア削除中に通信エラーが発生しました。" },
      503
    );
  }
}