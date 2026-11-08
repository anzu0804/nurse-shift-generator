"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

export default function EditLeaveRequestPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [staffs, setStaffs] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<LeaveRequestForm>({
    staff_id: "",
    leave_date: "",
    leave_type: "",
    status: "申請済み",
    note: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      const requestResponse = await fetch(`/api/leave-requests/${id}`);
      const requestData = await requestResponse.json();

      if (!requestResponse.ok) {
        alert(requestData.error ?? "希望休の取得に失敗しました");
        return;
      }

      const staffResponse = await fetch("/api/staffs");
      const staffData = await staffResponse.json();

      if (!staffResponse.ok) {
        alert(staffData.error ?? "スタッフ一覧の取得に失敗しました");
        return;
      }

      setStaffs(Array.isArray(staffData) ? staffData : []);

      setForm({
        staff_id: String(requestData.staff_id),
        leave_date: requestData.leave_date ?? "",
        leave_type: requestData.leave_type ?? "",
        status: requestData.status ?? "申請済み",
        note: requestData.note ?? "",
      });

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleUpdate = async () => {
    const response = await fetch(`/api/leave-requests/${id}`, {
      method: "PUT",
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
      alert(data.error ?? "更新に失敗しました");
      return;
    }

    alert("希望休を更新しました！");
    router.push("/leave-requests");
    router.refresh();
  };

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="希望休編集"
        description="希望休情報を編集します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <label className="mb-2 block font-medium">スタッフ</label>
          <Select
            value={form.staff_id}
            onChange={(e) =>
              setForm({
                ...form,
                staff_id: e.target.value,
              })
            }
          >
            {staffs.map((staff) => (
              <option key={staff.id} value={staff.id}>
                {staff.employee_no} {staff.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">希望日</label>
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
          <label className="mb-2 block font-medium">休暇種別</label>
          <Select
            value={form.leave_type}
            onChange={(e) =>
              setForm({
                ...form,
                leave_type: e.target.value,
              })
            }
          >
            <option value="有給">有給</option>
            <option value="生理休暇">生理休暇</option>
            <option value="夏休み">夏休み</option>
            <option value="誕生日">誕生日</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">状態</label>
          <Select
            value={form.status}
            onChange={(e) =>
              setForm({
                ...form,
                status: e.target.value,
              })
            }
          >
            <option value="申請済み">申請済み</option>
            <option value="確定">確定</option>
            <option value="取消">取消</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">備考</label>
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

        <PrimaryButton onClick={handleUpdate}>
          更新する
        </PrimaryButton>
      </div>
    </div>
  );
}