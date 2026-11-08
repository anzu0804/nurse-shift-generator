"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

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

  const [form, setForm] = useState<MeetingForm>({
    meeting_name: "",
    meeting_date: "",
    time_period: "",
    recurrence_type: "なし",
    recurrence_rule: "",
    is_active: true,
  });

  useEffect(() => {
  const fetchData = async () => {
    // 会議情報
    const meetingResponse = await fetch(`/api/meetings/${id}`);
    const meetingData = await meetingResponse.json();

    if (!meetingResponse.ok) {
      alert(meetingData.error ?? "会議情報の取得に失敗しました");
      return;
    }

    // スタッフ一覧
    const staffResponse = await fetch("/api/staffs");
    const staffData = await staffResponse.json();

    if (!staffResponse.ok) {
      alert(staffData.error ?? "スタッフ一覧の取得に失敗しました");
      return;
    }

    // この会議の担当スタッフ
    const meetingStaffResponse = await fetch(
      `/api/meeting-staffs?meeting_id=${id}`
    );

    const meetingStaffData =
      await meetingStaffResponse.json();

    if (!meetingStaffResponse.ok) {
      alert(
        meetingStaffData.error ??
          "担当スタッフの取得に失敗しました"
      );
      return;
    }

    setForm({
      meeting_name: meetingData.meeting_name ?? "",
      meeting_date: meetingData.meeting_date ?? "",
      time_period: meetingData.time_period ?? "",
      recurrence_type:
        meetingData.recurrence_type ?? "なし",
      recurrence_rule:
        meetingData.recurrence_rule ?? "",
      is_active: meetingData.is_active ?? true,
    });

    setStaffs(
      Array.isArray(staffData) ? staffData : []
    );

    setSelectedStaffIds(
      Array.isArray(meetingStaffData)
        ? meetingStaffData.map(
            (item) => item.staff_id
          )
        : []
    );

    setLoading(false);
  };

  fetchData();
}, [id]);

 const handleUpdate = async () => {
  const response = await fetch(
    `/api/meetings/${id}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "会議の更新に失敗しました");
    return;
  }

  // 既存の担当スタッフを削除
  const deleteResponse = await fetch(
    `/api/meeting-staffs?meeting_id=${id}`,
    {
      method: "DELETE",
    }
  );

  const deleteData =
    await deleteResponse.json();

  if (!deleteResponse.ok) {
    alert(
      deleteData.error ??
        "担当スタッフの更新に失敗しました"
    );
    return;
  }

  // 現在選択されているスタッフを登録
  const results = await Promise.all(
    selectedStaffIds.map((staffId) =>
      fetch("/api/meeting-staffs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meeting_id: Number(id),
          staff_id: staffId,
        }),
      })
    )
  );

  if (results.some((result) => !result.ok)) {
    alert("担当スタッフの登録に失敗しました");
    return;
  }

  alert("会議情報を更新しました！");

  router.push("/meetings");
  router.refresh();
};

  if (loading) {
    return <p>読み込み中...</p>;
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

        <PrimaryButton onClick={handleUpdate}>
          更新する
        </PrimaryButton>
      </div>
    </div>
  );
}
