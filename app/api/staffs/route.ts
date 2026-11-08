import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("staffs")
    .select("*")
    .order("employee_no");

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
    .from("staffs")
    .insert([
  {
    employee_no: body.employee_no,
    name: body.name,
    gender: body.gender,
    job_type: body.job_type,
    team: body.team,
    role: body.role,
    can_night_shift: body.can_night_shift,
    employment_status: body.employment_status ?? "在籍中",
    is_active: body.is_active ?? true,
    joined_date: body.joined_date || null,
    retired_date: body.retired_date || null,
    remarks: body.remarks || null,
  },
])
    .select();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(data, { status: 201 });
}