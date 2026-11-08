"use client";

import { useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useEffect, useState } from "react";

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
    const response = await fetch("/api/meetings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "登録に失敗しました");
      return;
    }

    await Promise.all(
  selectedStaffIds.map((staffId) =>
    fetch("/api/meeting-staffs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meeting_id: data.id,
        staff_id: staffId,
      }),
    })
  )
);

    alert("会議を登録しました");

    router.push("/meetings");
    router.refresh();
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

        <PrimaryButton onClick={handleCreate}>
          登録する
        </PrimaryButton>


      </div>
    </div>
  );
}