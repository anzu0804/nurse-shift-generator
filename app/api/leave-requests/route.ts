import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .order("leave_date", { ascending: true });

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