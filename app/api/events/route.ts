import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 一覧取得
export async function GET() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// 新規登録
export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("events")
    .insert([
      {
        event_name: body.event_name,
        event_date: body.event_date || null,
        time_period: body.time_period || null,
        recurrence_type: body.recurrence_type || "なし",
        recurrence_rule: body.recurrence_rule || null,
        event_type: body.event_type || null,
        note: body.note || null,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { error: "イベントの登録に失敗しました" },
      { status: 500 }
    );
  }

  return NextResponse.json(data[0], {
    status: 201,
  });
}