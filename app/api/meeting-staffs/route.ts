import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// 一覧取得
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get("meeting_id");

  let query = supabase
    .from("meeting_staffs")
    .select("*")
    .order("id");

  if (meetingId) {
    query = query.eq("meeting_id", meetingId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

// 登録
export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("meeting_staffs")
    .insert([
      {
        meeting_id: body.meeting_id,
        staff_id: body.staff_id,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data[0], {
    status: 201,
  });
}

// 会議に紐づく担当スタッフを一括削除
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const meetingId = searchParams.get("meeting_id");

  if (!meetingId) {
    return NextResponse.json(
      { error: "meeting_id が必要です" },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("meeting_staffs")
    .delete()
    .eq("meeting_id", meetingId);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "担当スタッフを削除しました",
  });
}