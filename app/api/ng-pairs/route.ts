import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("ng_pairs")
    .select("*")
    .eq("is_active", true)
    .order("id");

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
    .from("ng_pairs")
    .insert([
      {
        staff_a_id: body.staff_a_id,
        staff_b_id: body.staff_b_id,
        reason: body.reason,
        is_active: true,
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