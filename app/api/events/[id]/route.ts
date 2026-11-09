import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

type Params = {
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

function parseId(value: string) {
  const id = Number(value);

  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(id)
  ) {
    return null;
  }

  return id;
}

// 1件取得
export async function GET(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;
    const eventId = parseId(id);

    if (eventId === null) {
      return reply(
        { error: "予定IDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "予定を閲覧する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "予定情報を取得できませんでした。" },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "予定が見つからないか、閲覧権限がありません。",
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
      { error: "予定情報の取得中に通信エラーが発生しました。" },
      503
    );
  }
}

// 更新
export async function PUT(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;
    const eventId = parseId(id);

    if (eventId === null) {
      return reply(
        { error: "予定IDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply(
        {
          error:
            "送信データの形式が正しくありません。",
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return reply(
        {
          error:
            "送信データの形式が正しくありません。",
        },
        400
      );
    }

    const dataBody =
      body as Record<string, unknown>;

    const eventName =
      typeof dataBody.event_name === "string"
        ? dataBody.event_name.trim()
        : "";

    if (!eventName) {
      return reply(
        { error: "予定名を入力してください。" },
        400
      );
    }

    const { data, error } = await supabase
      .from("events")
      .update({
        event_name: eventName,

        event_date:
          typeof dataBody.event_date === "string" &&
          dataBody.event_date
            ? dataBody.event_date
            : null,

        time_period:
          typeof dataBody.time_period === "string" &&
          dataBody.time_period
            ? dataBody.time_period
            : null,

        recurrence_type:
          typeof dataBody.recurrence_type === "string" &&
          dataBody.recurrence_type
            ? dataBody.recurrence_type
            : "なし",

        recurrence_rule:
          typeof dataBody.recurrence_rule === "string" &&
          dataBody.recurrence_rule.trim()
            ? dataBody.recurrence_rule.trim()
            : null,

        event_type:
          typeof dataBody.event_type === "string" &&
          dataBody.event_type
            ? dataBody.event_type
            : null,

        note:
          typeof dataBody.note === "string" &&
          dataBody.note.trim()
            ? dataBody.note.trim()
            : null,
      })
      .eq("id", eventId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "予定を更新する権限がありません。" },
          403
        );
      }

      if (error.code === "23514") {
        return reply(
          {
            error:
              "予定の登録条件に合っていません。",
          },
          422
        );
      }

      return reply(
        { error: "予定の更新に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "更新対象の予定が見つからないか、更新権限がありません。",
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
      { error: "予定更新中に通信エラーが発生しました。" },
      503
    );
  }
}

// 削除
export async function DELETE(
  request: Request,
  { params }: Params
) {
  try {
    const { id } = await params;
    const eventId = parseId(id);

    if (eventId === null) {
      return reply(
        { error: "予定IDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("events")
      .delete()
      .eq("id", eventId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "予定を削除する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "予定の削除に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "削除対象の予定が見つからないか、削除権限がありません。",
        },
        404
      );
    }

    return reply({
      message: "予定を削除しました。",
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
      { error: "予定削除中に通信エラーが発生しました。" },
      503
    );
  }
}