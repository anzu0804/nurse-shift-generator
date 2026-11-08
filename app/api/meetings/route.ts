import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();

  const { data, error } = await supabase
    .from("meetings")
    .insert([
      {
        meeting_name: body.meeting_name,
        meeting_date: body.meeting_date || null,
        time_period: body.time_period || null,
        recurrence_type: body.recurrence_type || "なし",
        recurrence_rule: body.recurrence_rule || null,
        is_active: body.is_active ?? true,
      },
    ])
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data[0], { status: 201 });
}