"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type LeaveRequestForm = {
  staff_id: string;
  leave_date: string;
  leave_type: string;
  status: string;
  note: string;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
};

export default function NewLeaveRequestPage() {
  const router = useRouter();

  const [staffs, setStaffs] = useState<Staff[]>([]);

  const [form, setForm] = useState<LeaveRequestForm>({
    staff_id: "",
    leave_date: "",
    leave_type: "",
    status: "申請済み",
    note: "",
  });

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

  const handleSubmit = async () => {
    if (!form.staff_id) {
      alert("スタッフを選択してください");
      return;
    }

    if (!form.leave_date) {
      alert("希望日を入力してください");
      return;
    }

    if (!form.leave_type) {
      alert("休暇種別を選択してください");
      return;
    }

    const response = await fetch("/api/leave-requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        staff_id: Number(form.staff_id),
        leave_date: form.leave_date,
        leave_type: form.leave_type,
        status: form.status,
        note: form.note,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "登録に失敗しました");
      return;
    }

    alert("希望休を登録しました！");

    router.push("/leave-requests");
    router.refresh();
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="希望休登録"
        description="希望休を登録します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">

        <div>
          <label className="mb-2 block font-medium">
            スタッフ
          </label>

          <Select
            value={form.staff_id}
            onChange={(e) =>
              setForm({
                ...form,
                staff_id: e.target.value,
              })
            }
          >
            <option value="">
              選択してください
            </option>

            {staffs.map((staff) => (
              <option
                key={staff.id}
                value={staff.id}
              >
                {staff.employee_no} {staff.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            希望日
          </label>

          <Input
            type="date"
            value={form.leave_date}
            onChange={(e) =>
              setForm({
                ...form,
                leave_date: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            休暇種別
          </label>

          <Select
            value={form.leave_type}
            onChange={(e) =>
              setForm({
                ...form,
                leave_type: e.target.value,
              })
            }
          >
            <option value="">選択してください</option>
            <option value="有給">有給</option>
            <option value="生理休暇">生理休暇</option>
            <option value="夏休み">夏休み</option>
            <option value="誕生日">誕生日</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            備考
          </label>

          <Input
            value={form.note}
            onChange={(e) =>
              setForm({
                ...form,
                note: e.target.value,
              })
            }
          />
        </div>

        <PrimaryButton onClick={handleSubmit}>
          登録する
        </PrimaryButton>

      </div>
    </div>
  );
}