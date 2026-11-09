"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type MeetingForm = {
  meeting_name: string;
  meeting_date: string;
  time_period: string;
  recurrence_type: string;
  recurrence_rule: string;
  is_active: boolean;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
};


export default function NewMeetingPage() {
  const router = useRouter();

  const [staffs, setStaffs] = useState<Staff[]>([]);
const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);
const [saving, setSaving] = useState(false);
const savingRef = useRef(false);

useEffect(() => {
  const fetchStaffs = async () => {
    const response = await fetch("/api/staffs");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "スタッフ一覧の取得に失敗しました");
      return;
    }

    setStaffs(Array.isArray(data) ? data : []);
  };

  fetchStaffs();
}, []);

  const [form, setForm] = useState<MeetingForm>({
    meeting_name: "",
    meeting_date: "",
    time_period: "",
    recurrence_type: "なし",
    recurrence_rule: "",
    is_active: true,
  });

  const handleCreate = async () => {
  if (savingRef.current) {
    return;
  }

  if (!form.meeting_name.trim()) {
    alert("会議名を入力してください。");
    return;
  }

  if (
    form.recurrence_type === "なし" &&
    !form.meeting_date
  ) {
    alert("開催日を入力してください。");
    return;
  }

  savingRef.current = true;
  setSaving(true);

  let registered = false;

  try {
    // ブラウザのログイン情報を取り出す
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      alert("ログイン状態を確認できません。ログインし直してください。");
      return;
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      alert("ログインが必要です。");
      router.push("/login");
      return;
    }

    // 会議情報と担当スタッフを、1回のリクエストで送る
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      redirect: "error",
      body: JSON.stringify({
        ...form,
        staff_ids: selectedStaffIds,
      }),
    });

    if (response.status === 401) {
      alert("ログインの有効期限を確認できません。ログインし直してください。");
      router.push("/login");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      alert(
        typeof data?.error === "string"
          ? data.error
          : "登録結果を確認できません。再登録前に一覧を確認してください。"
      );
      return;
    }

    if (
      !data ||
      !Number.isSafeInteger(data.id) ||
      !Array.isArray(data.staff_ids)
    ) {
      alert(
        "登録結果を確認できません。もう一度登録せず、先に会議一覧を確認してください。"
      );
      return;
    }

    registered = true;

    alert(
      `会議と担当スタッフ${data.staff_ids.length}人を登録しました。`
    );

    router.push("/meetings");
    router.refresh();
  } catch {
    alert(
      "通信に失敗しました。登録済みの可能性があるため、再登録する前に会議一覧を確認してください。"
    );
  } finally {
    // 成功時は画面移動までボタンを無効にしておく
    if (!registered) {
      savingRef.current = false;
      setSaving(false);
    }
  }
};

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="会議登録"
        description="会議情報を登録します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">

        <div>
          <label className="mb-2 block font-medium">
            会議名
          </label>

          <Input
            placeholder="師長会議"
            value={form.meeting_name}
            onChange={(e) =>
              setForm({
                ...form,
                meeting_name: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            開催日
          </label>

          <Input
            type="date"
            value={form.meeting_date}
            onChange={(e) =>
              setForm({
                ...form,
                meeting_date: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            時間帯
          </label>

          <Select
            value={form.time_period}
            onChange={(e) =>
              setForm({
                ...form,
                time_period: e.target.value,
              })
            }
          >
            <option value="">選択してください</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="終日">終日</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            繰り返し
          </label>

          <Select
            value={form.recurrence_type}
            onChange={(e) =>
              setForm({
                ...form,
                recurrence_type: e.target.value,
              })
            }
          >
            <option value="なし">なし</option>
            <option value="毎週">毎週</option>
            <option value="毎月">毎月</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            繰り返し条件
          </label>

          <Input
            placeholder="第1月曜日"
            value={form.recurrence_rule}
            onChange={(e) =>
              setForm({
                ...form,
                recurrence_rule: e.target.value,
              })
            }
          />
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) =>
              setForm({
                ...form,
                is_active: e.target.checked,
              })
            }
          />

          <span className="font-medium">有効</span>
        </label>

<div>
  <label className="mb-2 block font-medium">
    担当スタッフ
  </label>

  <div className="space-y-2 rounded-lg border border-slate-200 p-4">
    {staffs.map((staff) => (
      <label
        key={staff.id}
        className="flex items-center gap-3"
      >
        <input
          type="checkbox"
          checked={selectedStaffIds.includes(staff.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedStaffIds([
                ...selectedStaffIds,
                staff.id,
              ]);
            } else {
              setSelectedStaffIds(
                selectedStaffIds.filter(
                  (id) => id !== staff.id
                )
              );
            }
          }}
        />

        <span>
          {staff.employee_no} {staff.name}
        </span>
      </label>
    ))}
  </div>
</div>

       <button
  type="button"
  onClick={() => void handleCreate()}
  disabled={saving}
  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {saving ? "登録中…" : "登録する"}
</button>


      </div>
    </div>
  );
}