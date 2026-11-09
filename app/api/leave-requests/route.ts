import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";
import {
  validateLeaveRequest,
  getLeaveDbError,
} from "@/lib/leave-request-validation";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

// 希望休一覧の取得
// ?month=2026-11 のように指定すると、その月だけ取得する
export async function GET(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    let startDate: string | null = null;
    let endDate: string | null = null;

    if (month !== null) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return reply(
          {
            error:
              "表示月をYYYY-MM形式で指定してください。",
          },
          400
        );
      }

      const [year, monthNumber] =
        month.split("-").map(Number);

      if (year < 100 || year > 9998) {
        return reply(
          {
            error:
              "表示年は0100～9998の範囲で指定してください。",
          },
          400
        );
      }

      const nextYear =
        monthNumber === 12 ? year + 1 : year;

      const nextMonth =
        monthNumber === 12 ? 1 : monthNumber + 1;

      startDate = `${month}-01`;

      endDate =
        `${String(nextYear).padStart(4, "0")}-` +
        `${String(nextMonth).padStart(2, "0")}-01`;
    }

    const rows: Record<string, unknown>[] = [];
    const pageSize = 500;
    let offset = 0;

    while (true) {
      let query = supabase
        .from("leave_requests")
        .select("*", { count: "exact" })
        .order("leave_date", { ascending: true })
        .order("id", { ascending: true });

      if (startDate && endDate) {
        query = query
          .gte("leave_date", startDate)
          .lt("leave_date", endDate);
      }

      const { data, error, count } = await query
        .range(offset, offset + pageSize - 1)
        .abortSignal(request.signal);

      if (error) {
        if (error.code === "42501") {
          return reply(
            {
              error:
                "希望休を閲覧する権限がありません。",
            },
            403
          );
        }

        return reply(
          {
            error:
              "希望休一覧を取得できませんでした。",
          },
          500
        );
      }

      if (
        !Array.isArray(data) ||
        typeof count !== "number"
      ) {
        return reply(
          {
            error:
              "希望休一覧の取得結果を確認できませんでした。",
          },
          500
        );
      }

      rows.push(...data);
      offset += data.length;

      if (offset >= count) {
        break;
      }

      if (data.length === 0) {
        return reply(
          {
            error:
              "希望休の取得中にデータが変更された可能性があります。再読み込みしてください。",
          },
          503
        );
      }
    }

    return reply(rows);
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
          "希望休一覧の通信に失敗しました。",
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

    const result =
      validateLeaveRequest(body, "create");

    if (!result.ok) {
      return reply(
        { error: result.error },
        400
      );
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .insert(result.data)
      .select()
      .single();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "希望休を登録する権限がありません。",
          },
          403
        );
      }

      const resultError =
        getLeaveDbError(error.code);

      return reply(
        { error: resultError.message },
        resultError.status
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "登録結果を確認できませんでした。一覧を再読み込みしてください。",
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
          "通信に失敗しました。一覧を再読み込みして、登録の有無を確認してください。",
      },
      503
    );
  }
}