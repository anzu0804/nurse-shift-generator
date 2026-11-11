"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

type ConditionForm = {
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

const current = new Date();

const initialForm: ConditionForm = {
  target_year: current.getFullYear(),
  target_month: current.getMonth() + 1,
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
  night_shift_next_day_after: true,
balance_weekend_shifts: true,
};

export default function ConditionsPage() {
  const [form, setForm] =
    useState<ConditionForm>(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedForm, setSavedForm] =
  useState<ConditionForm | null>(null);
const hasUnsavedChanges =
  savedForm !== null &&
  JSON.stringify(form) !== JSON.stringify(savedForm);

  const fetchCondition = async (
    year: number,
    month: number
  ) => {
    try {
      setLoading(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        alert("ログイン状態を確認できません。");
        return;
      }

      const token = sessionData.session?.access_token;

      if (!token) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch(
        `/api/conditions?year=${year}&month=${month}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      if (!response.ok) {
        alert(
          data.error ??
            "シフト条件の取得に失敗しました。"
        );
        return;
      }

      const loadedForm: ConditionForm = {
        target_year: Number(data.target_year),
        target_month: Number(data.target_month),
        calculated_public_holidays: Number(
          data.calculated_public_holidays ?? 0
        ),
        max_consecutive_work_days: Number(
          data.max_consecutive_work_days ?? 5
        ),
        default_night_shift_limit: Number(
          data.default_night_shift_limit ?? 4
        ),
        weekday_day_staff_count: Number(
          data.weekday_day_staff_count ?? 0
        ),
        saturday_day_staff_count: Number(
          data.saturday_day_staff_count ?? 0
        ),
        sunday_day_staff_count: Number(
          data.sunday_day_staff_count ?? 0
        ),
        night_staff_count: Number(
          data.night_staff_count ?? 0
        ),
        free_day_staff_count: Number(
          data.free_day_staff_count ?? 0
        ),
        free_night_staff_count: Number(
          data.free_night_staff_count ?? 0
        ),
        assistant_day_staff_count: Number(
          data.assistant_day_staff_count ?? 0
        ),
        assistant_late_staff_count: Number(
          data.assistant_late_staff_count ?? 0
        ),
        bath_nurse_count: Number(
          data.bath_nurse_count ?? 1
        ),
        bath_assistant_count: Number(
          data.bath_assistant_count ?? 2
        ),
        night_shift_next_day_after:
  data.night_shift_next_day_after !== false,

balance_weekend_shifts:
  data.balance_weekend_shifts !== false,
};

setForm(loadedForm);
setSavedForm(loadedForm);

      setIsSaved(Boolean(data.is_saved));
    } catch {
      alert("シフト条件の取得中に通信エラーが発生しました。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCondition(
      form.target_year,
      form.target_month
    );
  }, []);

  const changeTargetMonth = (
  year: number,
  month: number
) => {
  if (
    year === form.target_year &&
    month === form.target_month
  ) {
    return;
  }

  if (hasUnsavedChanges) {
    const discard = window.confirm(
      "保存していない変更があります。\n\n変更を破棄して別の月へ移動しますか？"
    );

    if (!discard) {
      return;
    }
  }

  void fetchCondition(year, month);
};

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        alert("ログイン状態を確認できません。");
        return;
      }

      const token = sessionData.session?.access_token;

      if (!token) {
        window.location.assign("/login");
        return;
      }

      const response = await fetch("/api/conditions", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }

      if (!response.ok) {
        alert(
          data.error ??
            "シフト条件の保存に失敗しました。"
        );
        return;
      }

  setIsSaved(true);
setSavedForm({ ...form });

alert("シフト条件を保存しました！");
    } catch {
      alert("シフト条件の保存中に通信エラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  const numberField = (
    label: string,
    key: keyof ConditionForm,
    description?: string,
    step = 1
  ) => (
    <div>
      <label className="mb-2 block font-medium">
        {label}
      </label>

      {description && (
        <p className="mb-2 text-sm text-slate-500">
          {description}
        </p>
      )}

      <Input
        type="number"
        min="0"
        step={String(step)}
        value={String(form[key])}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            [key]: Number(e.target.value),
          }))
        }
      />
    </div>
  );

  if (loading) {
    return <p>条件を読み込み中...</p>;
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="条件管理"
        description="シフト自動作成に使用する月ごとの条件を設定します。"
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-bold">
          対象年月
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block font-medium">
              年
            </span>

            <Input
              type="number"
              min="2000"
              max="9998"
              value={String(form.target_year)}
              onChange={(e) =>
                changeTargetMonth(
                  Number(e.target.value),
                  form.target_month
                )
              }
            />
          </label>

          <label>
            <span className="mb-2 block font-medium">
              月
            </span>

            <select
              value={form.target_month}
              onChange={(e) =>
                changeTargetMonth(
                  form.target_year,
                  Number(e.target.value)
                )
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2"
            >
              {Array.from({ length: 12 }, (_, index) => {
                const month = index + 1;

                return (
                  <option key={month} value={month}>
                    {month}月
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <p className="mt-4 text-sm">
  状態：
  <span
    className={
      hasUnsavedChanges
        ? "font-medium text-red-700"
        : isSaved
          ? "font-medium text-green-700"
          : "font-medium text-amber-700"
    }
  >
    {hasUnsavedChanges
      ? "未保存の変更あり"
      : isSaved
        ? "保存済み"
        : "未保存（初期値を表示中）"}
  </span>
</p>
      </div>

      <div className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">
            基本ルール
          </h2>

          <div className="grid gap-5 md:grid-cols-3">
            {numberField(
              "公休数",
              "calculated_public_holidays",
              "その月に必要な公休数。0.5単位も入力できます。",
              0.5
            )}

            {numberField(
              "連続勤務上限",
              "max_consecutive_work_days",
              "連続して勤務できる最大日数。"
            )}

            {numberField(
              "夜勤回数上限",
              "default_night_shift_limit",
              "スタッフごとの個別設定がない場合の標準上限。"
            )}
          </div>
        </section>

<section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
  <h2 className="mb-5 text-lg font-bold">
    勤務ルール
  </h2>

  <div className="space-y-4">
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={form.night_shift_next_day_after}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            night_shift_next_day_after:
              e.target.checked,
          }))
        }
        className="mt-1 h-4 w-4"
      />

      <div>
        <p className="font-medium">
          夜勤の翌日は「明け」にする
        </p>

        <p className="text-sm text-slate-500">
          夜勤勤務の翌日を明け勤務として扱います。
        </p>
      </div>
    </label>

    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={form.balance_weekend_shifts}
        onChange={(e) =>
          setForm((prev) => ({
            ...prev,
            balance_weekend_shifts:
              e.target.checked,
          }))
        }
        className="mt-1 h-4 w-4"
      />

      <div>
        <p className="font-medium">
          土日勤務をできるだけ均等にする
        </p>

        <p className="text-sm text-slate-500">
          スタッフ間で土日の勤務回数に偏りが出にくいようにします。
        </p>
      </div>
    </label>
  </div>
</section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">
            必要配置人数
          </h2>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {numberField(
              "平日の日勤",
              "weekday_day_staff_count"
            )}

            {numberField(
              "土曜の日勤",
              "saturday_day_staff_count"
            )}

            {numberField(
              "日曜の日勤",
              "sunday_day_staff_count"
            )}

            {numberField(
              "夜勤",
              "night_staff_count"
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">
            フリー配置
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            {numberField(
              "フリー日勤",
              "free_day_staff_count"
            )}

            {numberField(
              "フリー夜勤",
              "free_night_staff_count"
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">
            看護補助配置
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            {numberField(
              "看護補助・日勤",
              "assistant_day_staff_count"
            )}

            {numberField(
              "看護補助・遅番",
              "assistant_late_staff_count"
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-lg font-bold">
            入浴介助
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            {numberField(
              "入浴担当看護師",
              "bath_nurse_count"
            )}

            {numberField(
              "入浴担当補助者",
              "bath_assistant_count"
            )}
          </div>
        </section>

        <div className="sticky bottom-4 flex justify-end">
        <PrimaryButton
  onClick={handleSave}
  disabled={saving || !hasUnsavedChanges}
>
          {saving
  ? "保存中..."
  : hasUnsavedChanges
    ? "この条件を保存"
    : "保存済み"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}