"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type NgPairForm = {
  staff_a_id: string;
  staff_b_id: string;
  reason: string;
  is_active: boolean;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
};

export default function EditNgPairPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const id = params.id;

  const [staffs, setStaffs] = useState<Staff[]>([]);

  const [form, setForm] = useState<NgPairForm>({
    staff_a_id: "",
    staff_b_id: "",
    reason: "",
    is_active: true,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const pairResponse = await fetch(`/api/ng-pairs/${id}`);
      const pair = await pairResponse.json();

      const staffResponse = await fetch("/api/staffs");
      const staffData = await staffResponse.json();

      setStaffs(staffData);

      setForm({
        staff_a_id: String(pair.staff_a_id),
        staff_b_id: String(pair.staff_b_id),
        reason: pair.reason ?? "",
        is_active: pair.is_active,
      });

      setLoading(false);
    };

    fetchData();
  }, [id]);

  const handleUpdate = async () => {
  const response = await fetch(`/api/ng-pairs/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      staff_a_id: Number(form.staff_a_id),
      staff_b_id: Number(form.staff_b_id),
      reason: form.reason,
      is_active: form.is_active,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "更新に失敗しました");
    return;
  }

  alert("NGペアを更新しました！");

  router.push("/ng-pairs");
};

if (loading) {
  return <p>読み込み中...</p>;
}

return (
  <div className="max-w-3xl">
    <PageHeader
      title="NGペア編集"
      description="NGペア情報を編集します。"
    />

    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">

      <div>
        <label className="mb-2 block font-medium">
          スタッフA
        </label>

        <Select
          value={form.staff_a_id}
          onChange={(e) =>
            setForm({
              ...form,
              staff_a_id: e.target.value,
            })
          }
        >
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
          スタッフB
        </label>

        <Select
          value={form.staff_b_id}
          onChange={(e) =>
            setForm({
              ...form,
              staff_b_id: e.target.value,
            })
          }
        >
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
          理由
        </label>

        <Input
          value={form.reason}
          onChange={(e) =>
            setForm({
              ...form,
              reason: e.target.value,
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