import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("staffs")
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

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("staffs")
    .update({
  employee_no: body.employee_no,
  name: body.name,
  gender: body.gender,
  job_type: body.job_type,
  team: body.team,
  role: body.role,
  can_night_shift: body.can_night_shift,
  employment_status: body.employment_status,
  is_active: body.is_active,
  joined_date: body.joined_date || null,
  retired_date: body.retired_date || null,
  remarks: body.remarks || null,
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
      { error: "更新対象のスタッフが見つからないか、更新権限がありません。" },
      { status: 404 }
    );
  }

  return NextResponse.json(data[0]);
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;

  const { data, error } = await supabase
    .from("staffs")
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
          "削除対象のスタッフが見つからないか、削除権限がありません。",
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message: "スタッフを削除しました。",
  });
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const body = await request.json();

  const { data, error } = await supabase
    .from("staffs")
    .update({
      employment_status: body.employment_status,
      is_active: body.is_active,
      retired_date: body.retired_date,
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
      { error: "対象のスタッフが見つかりません" },
      { status: 404 }
    );
  }

  return NextResponse.json(data[0]);
}