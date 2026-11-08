import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  parsePositiveId,
  validateLeaveRequest,
  getLeaveDbError,
} from "@/lib/leave-request-validation";

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
  request: Request,
  { params }: RouteContext
) {
  const { id } = await params;
  const requestId = parsePositiveId(id);

  if (requestId === null) {
    return NextResponse.json(
      { error: "希望休IDが正しくありません。" },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "送信データの形式が正しくありません。" },
      { status: 400 }
    );
  }

  const result = validateLeaveRequest(body, "update");

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("leave_requests")
      .update(result.data)
      .eq("id", requestId)
      .select()
      .maybeSingle();

    if (error) {
      const resultError = getLeaveDbError(error.code);

      return NextResponse.json(
        { error: resultError.message },
        { status: resultError.status }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "更新対象の希望休が見つからないか、更新権限がありません。",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error:
          "通信に失敗しました。一覧を再読み込みして、更新結果を確認してください。",
      },
      { status: 500 }
    );
  }
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