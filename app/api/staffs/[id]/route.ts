import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

function parseId(value: string) {
  const id = Number(value);

  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(id)
  ) {
    return null;
  }

  return id;
}

export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "スタッフIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("staffs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを閲覧する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "スタッフ情報を取得できませんでした。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "スタッフが見つかりません。" },
        404
      );
    }

    return reply(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "スタッフ情報の取得中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "スタッフIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const body = await request.json();

    const { data, error } = await supabase
      .from("staffs")
      .update({
        employee_no: body.employee_no,
        name: body.name,
        gender: body.gender || null,
        job_type: body.job_type || null,
        team: body.team || null,
        role: body.role || null,
        can_night_shift: body.can_night_shift === true,
        employment_status: body.employment_status,
        is_active: body.is_active,
        joined_date: body.joined_date || null,
        retired_date: body.retired_date || null,
        remarks: body.remarks || null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを更新する権限がありません。" },
          403
        );
      }

      if (error.code === "23505") {
        return reply(
          { error: "同じ社員番号のスタッフがすでに登録されています。" },
          409
        );
      }

      return reply(
        { error: "スタッフの更新に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "更新対象のスタッフが見つかりません。" },
        404
      );
    }

    return reply(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "スタッフ更新中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "スタッフIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const body = await request.json();

    const { data, error } = await supabase
      .from("staffs")
      .update({
        employment_status: body.employment_status,
        is_active: body.is_active,
        retired_date: body.retired_date || null,
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを変更する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "退職処理に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "対象のスタッフが見つかりません。" },
        404
      );
    }

    return reply(data);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "退職処理中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const id = parseId((await params).id);

    if (id === null) {
      return reply(
        { error: "スタッフIDが正しくありません。" },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("staffs")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを削除する権限がありません。" },
          403
        );
      }

      if (error.code === "23503") {
        return reply(
          {
            error:
              "このスタッフは関連データから参照されているため削除できません。",
          },
          409
        );
      }

      return reply(
        { error: "スタッフの削除に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "削除対象のスタッフが見つかりません。" },
        404
      );
    }

    return reply({
      message: "スタッフを削除しました。",
      deleted_id: data.id,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "スタッフ削除中に通信エラーが発生しました。" },
      503
    );
  }
}