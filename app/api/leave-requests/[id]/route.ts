import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

// 取得
export async function GET(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("leave_requests")
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
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      staff_id: body.staff_id,
      leave_date: body.leave_date,
      leave_type: body.leave_type,
      status: body.status,
      note: body.note,
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
      { error: "対象データが見つかりません。" },
      { status: 404 }
    );
  }

  return NextResponse.json(data[0]);
}

// 削除
export async function DELETE(
  request: NextRequest,
  { params }: RouteContext
) {
  const { id } = await params;

  const { error } = await supabase
    .from("leave_requests")
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