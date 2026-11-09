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

// 一覧取得
export async function GET(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true })
      .order("id", { ascending: true });

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "予定を閲覧する権限がありません。",
          },
          403
        );
      }

      return reply(
        {
          error:
            "予定一覧を取得できませんでした。",
        },
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
      {
        error:
          "予定一覧の取得中に通信エラーが発生しました。",
      },
      503
    );
  }
}

// 新規登録
export async function POST(request: Request) {
  try {
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
        {
          error: "予定名を入力してください。",
        },
        400
      );
    }

    const { data, error } = await supabase
      .from("events")
      .insert({
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
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "予定を登録する権限がありません。",
          },
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
        {
          error:
            "予定の登録に失敗しました。",
        },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "予定の登録結果を確認できませんでした。",
        },
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
      {
        error:
          "予定登録中に通信エラーが発生しました。",
      },
      503
    );
  }
}