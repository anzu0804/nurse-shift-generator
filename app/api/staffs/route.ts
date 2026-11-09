import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

export async function GET(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("staffs")
      .select("*")
      .order("employee_no");

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを閲覧する権限がありません。" },
          403
        );
      }

      return reply(
        { error: "スタッフ一覧を取得できませんでした。" },
        500
      );
    }

    return reply(data ?? []);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "スタッフ一覧の取得中に通信エラーが発生しました。" },
      503
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply(
        { error: "送信データの形式が正しくありません。" },
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return reply(
        { error: "送信データの形式が正しくありません。" },
        400
      );
    }

    const dataBody =
      body as Record<string, unknown>;

    const employeeNo =
      typeof dataBody.employee_no === "string"
        ? dataBody.employee_no.trim()
        : "";

    const name =
      typeof dataBody.name === "string"
        ? dataBody.name.trim()
        : "";

    if (!employeeNo) {
      return reply(
        { error: "社員番号を入力してください。" },
        400
      );
    }

    if (!name) {
      return reply(
        { error: "名前を入力してください。" },
        400
      );
    }

    const { data, error } = await supabase
      .from("staffs")
      .insert({
        employee_no: employeeNo,
        name,
        gender:
          typeof dataBody.gender === "string"
            ? dataBody.gender || null
            : null,
        job_type:
          typeof dataBody.job_type === "string"
            ? dataBody.job_type || null
            : null,
        team:
          typeof dataBody.team === "string"
            ? dataBody.team || null
            : null,
        role:
          typeof dataBody.role === "string"
            ? dataBody.role || null
            : null,
        can_night_shift:
          dataBody.can_night_shift === true,
        employment_status:
          typeof dataBody.employment_status === "string" &&
          dataBody.employment_status
            ? dataBody.employment_status
            : "在籍中",
        is_active:
          typeof dataBody.is_active === "boolean"
            ? dataBody.is_active
            : true,
        joined_date:
          typeof dataBody.joined_date === "string" &&
          dataBody.joined_date
            ? dataBody.joined_date
            : null,
        retired_date:
          typeof dataBody.retired_date === "string" &&
          dataBody.retired_date
            ? dataBody.retired_date
            : null,
        remarks:
          typeof dataBody.remarks === "string" &&
          dataBody.remarks.trim()
            ? dataBody.remarks.trim()
            : null,
      })
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          { error: "スタッフを登録する権限がありません。" },
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
        { error: "スタッフの登録に失敗しました。" },
        500
      );
    }

    if (!data) {
      return reply(
        { error: "スタッフの登録結果を確認できませんでした。" },
        500
      );
    }

    return reply(data, 201);
  } catch (error) {
    if (error instanceof AuthError) {
      return reply(
        { error: error.message },
        error.status
      );
    }

    return reply(
      { error: "スタッフ登録中に通信エラーが発生しました。" },
      503
    );
  }
}