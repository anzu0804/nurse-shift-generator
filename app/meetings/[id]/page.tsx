"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
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


export default function EditMeetingPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [staffs, setStaffs] = useState<Staff[]>([]);
const [selectedStaffIds, setSelectedStaffIds] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [loadError, setLoadError] = useState("");
const [loadedId, setLoadedId] = useState("");
const savingRef = useRef(false);

  const [form, setForm] = useState<MeetingForm>({
    meeting_name: "",
    meeting_date: "",
    time_period: "",
    recurrence_type: "なし",
    recurrence_rule: "",
    is_active: true,
  });

useEffect(() => {
  let cancelled = false;
  const controller = new AbortController();

  const fetchData = async () => {
    setLoading(true);
    setLoadError("");
    setLoadedId("");

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (cancelled) {
        return;
      }

      if (sessionError) {
        throw new Error(
          "ログイン状態を確認できません。ログインし直してください。"
        );
      }

      const token = sessionData.session?.access_token;

      if (!token) {
        router.replace("/login");
        return;
      }

      const [meetingResponse, staffResponse] = await Promise.all([
        fetch(`/api/meetings/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        }),
        fetch("/api/staffs", {
          cache: "no-store",
          signal: controller.signal,
        }),
      ]);

      if (cancelled) {
        return;
      }

      if (meetingResponse.status === 401) {
        router.replace("/login");
        return;
      }

      const [meetingData, staffData] = await Promise.all([
        meetingResponse.json(),
        staffResponse.json(),
      ]);

      if (!meetingResponse.ok) {
        throw new Error(
          typeof meetingData?.error === "string"
            ? meetingData.error
            : "会議情報を取得できませんでした。"
        );
      }

      if (!staffResponse.ok) {
        throw new Error(
          typeof staffData?.error === "string"
            ? staffData.error
            : "スタッフ一覧を取得できませんでした。"
        );
      }

      // 取得に失敗したデータを空のフォームとして扱わない
      if (
        !meetingData ||
        meetingData.id !== Number(id) ||
        typeof meetingData.meeting_name !== "string" ||
        typeof meetingData.is_active !== "boolean" ||
        !Array.isArray(meetingData.staff_ids) ||
        !meetingData.staff_ids.every(
          (staffId: unknown) =>
            typeof staffId === "number" &&
            Number.isSafeInteger(staffId) &&
            staffId > 0
        )
      ) {
        throw new Error(
          "会議または担当スタッフの取得結果を確認できません。"
        );
      }

      if (
        !Array.isArray(staffData) ||
        !staffData.every(
          (staff) =>
            staff &&
            typeof staff.id === "number" &&
            typeof staff.employee_no === "string" &&
            typeof staff.name === "string"
        )
      ) {
        throw new Error(
          "スタッフ一覧の取得結果を確認できません。"
        );
      }

      // 表示できない担当者を、気づかず選択解除しないようにする
      const hasMissingStaff = meetingData.staff_ids.some(
        (staffId: number) =>
          !staffData.some((staff) => staff.id === staffId)
      );

      if (hasMissingStaff) {
        throw new Error(
          "担当スタッフの一部を一覧から取得できません。保存せず、スタッフの閲覧設定を確認してください。"
        );
      }

      if (cancelled) {
        return;
      }

      setStaffs(staffData);

      setForm({
        meeting_name: meetingData.meeting_name,
        meeting_date: meetingData.meeting_date ?? "",
        time_period: meetingData.time_period ?? "",
        recurrence_type: meetingData.recurrence_type ?? "なし",
        recurrence_rule: meetingData.recurrence_rule ?? "",
        is_active: meetingData.is_active,
      });

      setSelectedStaffIds(meetingData.staff_ids);
      setLoadedId(id);
    } catch (error) {
      if (!cancelled) {
        setLoadError(
          error instanceof Error
            ? error.message
            : "読み込みに失敗しました。"
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  };

  void fetchData();

  return () => {
    cancelled = true;
    controller.abort();
  };
}, [id, router]);

const handleUpdate = async () => {
  if (
    savingRef.current ||
    loading ||
    loadError ||
    loadedId !== id
  ) {
    return;
  }

  if (!form.meeting_name.trim()) {
    alert("会議名を入力してください。");
    return;
  }

  savingRef.current = true;
  setSaving(true);

  let updated = false;

  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      alert("ログイン状態を確認できません。");
      return;
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      alert("ログインが必要です。");
      router.push("/login");
      return;
    }

    // 会議と担当スタッフを一度に送信する
    const response = await fetch(`/api/meetings/${id}`, {
      method: "PUT",
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
      alert("ログインし直してください。");
      router.push("/login");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      alert(
        typeof data?.error === "string"
          ? data.error
          : "更新結果を確認できません。一覧を確認してください。"
      );
      return;
    }

    if (
      !data ||
      data.id !== Number(id) ||
      !Array.isArray(data.staff_ids)
    ) {
      alert(
        "保存結果を確認できません。再更新する前に一覧を確認してください。"
      );
      return;
    }

    updated = true;

    alert(
      `会議情報と担当スタッフ${data.staff_ids.length}人を更新しました。`
    );

    router.push("/meetings");
    router.refresh();
  } catch {
    alert(
      "通信に失敗しました。更新済みの可能性があるため、再更新する前に一覧を確認してください。"
    );
  } finally {
    // 成功時は、一覧への移動までボタンを無効にする
    if (!updated) {
      savingRef.current = false;
      setSaving(false);
    }
  }
};

 if (loadError) {
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="会議編集"
        description="会議情報を編集します。"
      />

      <p
        role="alert"
        className="mb-4 rounded-lg bg-red-50 p-4 text-red-800"
      >
        {loadError}
      </p>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2"
      >
        再読み込み
      </button>
    </div>
  );
}

if (loading || loadedId !== id) {
  return <p role="status">読み込み中...</p>;
}

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="会議編集"
        description="会議情報を編集します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <label className="mb-2 block font-medium">
            会議名
          </label>

          <Input
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

          <span className="font-medium">
            有効
          </span>
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
          checked={selectedStaffIds.includes(
            staff.id
          )}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedStaffIds([
                ...selectedStaffIds,
                staff.id,
              ]);
            } else {
              setSelectedStaffIds(
                selectedStaffIds.filter(
                  (staffId) =>
                    staffId !== staff.id
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
  onClick={() => void handleUpdate()}
  disabled={saving}
  className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
>
  {saving ? "更新中…" : "更新する"}
</button>
      </div>
    </div>
  );
}
