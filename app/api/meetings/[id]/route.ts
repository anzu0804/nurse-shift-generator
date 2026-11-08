import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// 取得
export async function GET(
  request: Request,
  { params }: Params
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("meetings")
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
    .from("meetings")
    .update({
      meeting_name: body.meeting_name,
      meeting_date: body.meeting_date || null,
      time_period: body.time_period || null,
      recurrence_type: body.recurrence_type || "なし",
      recurrence_rule: body.recurrence_rule || null,
      is_active: body.is_active,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// 削除
export async function DELETE(
  request: Request,
  { params }: Params
) {
  const { id } = await params;

  const { error } = await supabase
    .from("meetings")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "削除しました",
  });
}