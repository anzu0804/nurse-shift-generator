import { NextResponse } from "next/server";
import {
  AuthError,
  getAuthenticatedSupabase,
} from "@/lib/authenticated-supabase";

type ConditionInput = {
  target_year: number;
  target_month: number;
  calculated_public_holidays: number;
  max_consecutive_work_days: number;
  default_night_shift_limit: number;
  weekday_day_staff_count: number;
  saturday_day_staff_count: number;
  sunday_day_staff_count: number;
  night_staff_count: number;
  free_day_staff_count: number;
  free_night_staff_count: number;
  assistant_day_staff_count: number;
  assistant_late_staff_count: number;
  bath_nurse_count: number;
  bath_assistant_count: number;
  night_shift_next_day_after: boolean;
balance_weekend_shifts: boolean;
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

function parseYear(value: unknown): number | null {
  const year = Number(value);

  if (
    !Number.isInteger(year) ||
    year < 2000 ||
    year > 9998
  ) {
    return null;
  }

  return year;
}

function parseMonth(value: unknown): number | null {
  const month = Number(value);

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return month;
}

function parseNonNegativeInteger(
  value: unknown
): number | null {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function parseNonNegativeNumber(
  value: unknown
): number | null {
  const number = Number(value);

  if (
    !Number.isFinite(number) ||
    number < 0
  ) {
    return null;
  }

  return number;
}

function validateCondition(
  body: Record<string, unknown>
):
  | { ok: true; data: ConditionInput }
  | { ok: false; error: string } {
  const targetYear = parseYear(body.target_year);
  const targetMonth = parseMonth(body.target_month);

  if (targetYear === null) {
    return {
      ok: false,
      error: "対象年は2000～9998で指定してください。",
    };
  }

  if (targetMonth === null) {
    return {
      ok: false,
      error: "対象月は1～12で指定してください。",
    };
  }

  const calculatedPublicHolidays =
    parseNonNegativeNumber(
      body.calculated_public_holidays
    );

  if (calculatedPublicHolidays === null) {
    return {
      ok: false,
      error: "公休数は0以上で入力してください。",
    };
  }

  const integerFields = {
    max_consecutive_work_days:
      "連続勤務上限",
    default_night_shift_limit:
      "夜勤回数上限",
    weekday_day_staff_count:
      "平日日勤人数",
    saturday_day_staff_count:
      "土曜日日勤人数",
    sunday_day_staff_count:
      "日曜日日勤人数",
    night_staff_count:
      "夜勤人数",
    free_day_staff_count:
      "フリー日勤人数",
    free_night_staff_count:
      "フリー夜勤人数",
    assistant_day_staff_count:
      "看護補助・日勤人数",
    assistant_late_staff_count:
      "看護補助・遅番人数",
    bath_nurse_count:
      "入浴担当看護師人数",
    bath_assistant_count:
      "入浴担当補助者人数",
  } as const;

  const values: Record<string, number> = {};

  for (const [field, label] of Object.entries(
    integerFields
  )) {
    const value =
      parseNonNegativeInteger(body[field]);

    if (value === null) {
      return {
        ok: false,
        error: `${label}は0以上の整数で入力してください。`,
      };
    }

    values[field] = value;
  }

  return {
    ok: true,
    data: {
      target_year: targetYear,
      target_month: targetMonth,
      calculated_public_holidays:
        calculatedPublicHolidays,
      max_consecutive_work_days:
        values.max_consecutive_work_days,
      default_night_shift_limit:
        values.default_night_shift_limit,
      weekday_day_staff_count:
        values.weekday_day_staff_count,
      saturday_day_staff_count:
        values.saturday_day_staff_count,
      sunday_day_staff_count:
        values.sunday_day_staff_count,
      night_staff_count:
        values.night_staff_count,
      free_day_staff_count:
        values.free_day_staff_count,
      free_night_staff_count:
        values.free_night_staff_count,
      assistant_day_staff_count:
        values.assistant_day_staff_count,
      assistant_late_staff_count:
        values.assistant_late_staff_count,
      bath_nurse_count:
        values.bath_nurse_count,
      bath_assistant_count:
        values.bath_assistant_count,
        night_shift_next_day_after:
  body.night_shift_next_day_after !== false,

balance_weekend_shifts:
  body.balance_weekend_shifts !== false,
    },
  };
}

// 指定年月の条件を取得
// GET /api/conditions?year=2026&month=11
export async function GET(request: Request) {
  try {
    const supabase =
      await getAuthenticatedSupabase(request);

    const { searchParams } = new URL(request.url);

    const year =
      parseYear(searchParams.get("year"));

    const month =
      parseMonth(searchParams.get("month"));

    if (year === null || month === null) {
      return reply(
        {
          error:
            "対象年月を正しく指定してください。",
        },
        400
      );
    }

    const { data, error } = await supabase
      .from("shift_conditions")
      .select("*")
      .eq("target_year", year)
      .eq("target_month", month)
      .maybeSingle();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "シフト条件を閲覧する権限がありません。",
          },
          403
        );
      }

      return reply(
        {
          error:
            "シフト条件を取得できませんでした。",
        },
        500
      );
    }

    // 未登録の月は、DBに勝手に保存せず初期値だけ返す
    if (!data) {
      return reply({
        id: null,
        target_year: year,
        target_month: month,
        calculated_public_holidays: 0,
        max_consecutive_work_days: 5,
        default_night_shift_limit: 4,
        weekday_day_staff_count: 0,
        saturday_day_staff_count: 0,
        sunday_day_staff_count: 0,
        night_staff_count: 0,
        free_day_staff_count: 0,
        free_night_staff_count: 0,
        assistant_day_staff_count: 0,
        assistant_late_staff_count: 0,
        bath_nurse_count: 1,
        bath_assistant_count: 2,
        is_saved: false,
        night_shift_next_day_after: true,
balance_weekend_shifts: true,
      });
    }

    return reply({
      ...data,
      is_saved: true,
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
          "シフト条件の取得中に通信エラーが発生しました。",
      },
      503
    );
  }
}

// 条件を新規登録または更新
export async function PUT(request: Request) {
  try {
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

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return reply(
        {
          error:
            "送信データの形式が正しくありません。",
        },
        400
      );
    }

    const validation = validateCondition(
      body as Record<string, unknown>
    );

    if (!validation.ok) {
      return reply(
        { error: validation.error },
        400
      );
    }

    const { data, error } = await supabase
      .from("shift_conditions")
      .upsert(
        {
          ...validation.data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "target_year,target_month",
        }
      )
      .select()
      .single();

    if (error) {
      if (error.code === "42501") {
        return reply(
          {
            error:
              "シフト条件を保存する権限がありません。",
          },
          403
        );
      }

      if (error.code === "23514") {
        return reply(
          {
            error:
              "入力値がシフト条件の制約に合っていません。",
          },
          422
        );
      }

      if (error.code === "23505") {
        return reply(
          {
            error:
              "同じ年月のシフト条件が重複しています。",
          },
          409
        );
      }

      return reply(
        {
          error:
            "シフト条件の保存に失敗しました。",
        },
        500
      );
    }

    return reply({
      ...data,
      is_saved: true,
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
          "シフト条件の保存中に通信エラーが発生しました。",
      },
      503
    );
  }
}