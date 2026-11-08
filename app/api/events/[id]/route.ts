import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// 1件取得
export async function GET(
  request: Request,
  { params }: Params
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}

// 更新
export async function PUT(
  request: Request,
  { params }: Params
) {
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("events")
    .update({
      event_name: body.event_name,
      event_date: body.event_date || null,
      time_period: body.time_period || null,
      recurrence_type: body.recurrence_type || "なし",
      recurrence_rule: body.recurrence_rule || null,
      event_type: body.event_type || null,
      note: body.note || null,
    })
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error:
          "更新対象のイベントが見つからないか、更新権限がありません。",
      },
      { status: 404 }
    );
  }

  return NextResponse.json(data[0]);
}

// 削除
export async function DELETE(
  request: Request,
  { params }: Params
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("events")
    .delete()
    .eq("id", id)
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      {
        error:
          "削除対象のイベントが見つからないか、削除権限がありません。",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message: "イベントを削除しました",
  });
}