import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 希望休一覧の取得
// ?month=2026-11 のように指定すると、その月だけ取得する
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");

  let startDate: string | null = null;
  let endDate: string | null = null;

  if (month !== null) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      return NextResponse.json(
        {
          error: "表示月をYYYY-MM形式で指定してください。",
        },
        { status: 400 }
      );
    }

    const [year, monthNumber] = month.split("-").map(Number);

    if (year < 100 || year > 9998) {
      return NextResponse.json(
        {
          error: "表示年は0100～9998の範囲で指定してください。",
        },
        { status: 400 }
      );
    }

    const nextYear = monthNumber === 12 ? year + 1 : year;
    const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;

    startDate = `${month}-01`;

    endDate =
      `${String(nextYear).padStart(4, "0")}-` +
      `${String(nextMonth).padStart(2, "0")}-01`;
  }

  try {
    // 件数が多い場合は、複数回に分けて取得する
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
        console.error("希望休一覧取得エラー:", error.code);

        return NextResponse.json(
          {
            error:
              "希望休一覧を取得できませんでした。接続状態と閲覧権限を確認してください。",
          },
          { status: 500 }
        );
      }

      if (!Array.isArray(data) || typeof count !== "number") {
        return NextResponse.json(
          {
            error: "希望休一覧の取得結果を確認できませんでした。",
          },
          { status: 500 }
        );
      }

      rows.push(...data);
      offset += data.length;

      if (offset >= count) {
        break;
      }

      if (data.length === 0) {
        return NextResponse.json(
          {
            error:
              "希望休の取得中にデータが変更された可能性があります。再読み込みしてください。",
          },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "希望休一覧の通信に失敗しました。接続状態を確認してください。",
      },
      { status: 500 }
    );
  }
}

// 新規登録：これまでの登録処理を残す
export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("leave_requests")
    .insert([
      {
        staff_id: body.staff_id,
        leave_date: body.leave_date,
        leave_type: body.leave_type,
        status: body.status ?? "申請済み",
        note: body.note || null,
      },
    ])
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}