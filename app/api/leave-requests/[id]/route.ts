import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";
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

function reply(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Authorization",
    },
  });
}

// 取得
export async function GET(
  request: Request,
  { params }: RouteContext
) {
  try {
    const requestId =
      parsePositiveId((await params).id);

    if (requestId === null) {
      return reply(
        {
          error:
            "希望休IDが正しくありません。",
        },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "希望休を閲覧する権限がありません。",
          },
          403
        );
      }

      return reply(
        {
          error:
            "希望休情報を取得できませんでした。",
        },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "希望休が見つかりません。",
        },
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
      {
        error:
          "希望休情報の取得中に通信エラーが発生しました。",
      },
      503
    );
  }
}

// 更新
export async function PUT(
  request: Request,
  { params }: RouteContext
) {
  try {
    const requestId =
      parsePositiveId((await params).id);

    if (requestId === null) {
      return reply(
        {
          error:
            "希望休IDが正しくありません。",
        },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return reply(
        {
          error:
            "送信データの形式が正しくありません。",
        },
        400
      );
    }

    const result =
      validateLeaveRequest(body, "update");

    if (!result.ok) {
      return reply(
        { error: result.error },
        400
      );
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .update(result.data)
      .eq("id", requestId)
      .select()
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "希望休を更新する権限がありません。",
          },
          403
        );
      }

      const resultError =
        getLeaveDbError(error.code);

      return reply(
        { error: resultError.message },
        resultError.status
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "更新対象の希望休が見つからないか、更新権限がありません。",
        },
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
      {
        error:
          "希望休更新中に通信エラーが発生しました。",
      },
      503
    );
  }
}

// 削除
export async function DELETE(
  request: Request,
  { params }: RouteContext
) {
  try {
    const requestId =
      parsePositiveId((await params).id);

    if (requestId === null) {
      return reply(
        {
          error:
            "希望休IDが正しくありません。",
        },
        400
      );
    }

    const supabase =
      await getAuthenticatedSupabase(request);

    const { data, error } = await supabase
      .from("leave_requests")
      .delete()
      .eq("id", requestId)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "希望休を削除する権限がありません。",
          },
          403
        );
      }

      if (error.code === "23503") {
        return reply(
          {
            error:
              "ほかのデータから参照されているため削除できません。申請を取り消す場合は、編集画面で状態を「取消」に変更してください。",
          },
          409
        );
      }

      return reply(
        {
          error:
            "削除結果を確認できませんでした。一覧を再読み込みしてください。",
        },
        500
      );
    }

    if (!data) {
      return reply(
        {
          error:
            "対象の希望休がすでに削除されているか、削除権限がありません。",
        },
        404
      );
    }

    return reply({
      message: "希望休を削除しました。",
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
      {
        error:
          "希望休削除中に通信エラーが発生しました。",
      },
      503
    );
  }
}