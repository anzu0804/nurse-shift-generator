"use client";

import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useEffect, useState } from "react";

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

export default function NewNgPairPage() {
  const [form, setForm] = useState<NgPairForm>({
    staff_a_id: "",
    staff_b_id: "",
    reason: "",
    is_active: true,
  });

  const [staffs, setStaffs] = useState<Staff[]>([]);

useEffect(() => {
  const fetchStaffs = async () => {
    const response = await fetch("/api/staffs");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "スタッフ一覧の取得に失敗しました");
      return;
    }

    setStaffs(data);
  };

  fetchStaffs();
}, []);

const handleSubmit = async () => {
  if (!form.staff_a_id || !form.staff_b_id) {
    alert("スタッフAとスタッフBを選択してください");
    return;
  }

  if (form.staff_a_id === form.staff_b_id) {
    alert("同じスタッフ同士はNGペアに登録できません");
    return;
  }

  if (!form.staff_a_id || !form.staff_b_id) {
  alert("スタッフAとスタッフBを選択してください");
  return;
}

if (form.staff_a_id === form.staff_b_id) {
  alert("同じスタッフ同士はNGペアに登録できません");
  return;
}

  const response = await fetch("/api/ng-pairs", {
    method: "POST",
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
    alert(data.error ?? "NGペアの登録に失敗しました");
    return;
  }

  alert("NGペアを登録しました！");

  setForm({
    staff_a_id: "",
    staff_b_id: "",
    reason: "",
    is_active: true,
  });
};

  return (
  <div className="max-w-3xl">
    <PageHeader
      title="NGペア登録"
      description="NGペアを登録します。"
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
  <option value="">選択してください</option>

  {staffs.map((staff) => (
    <option key={staff.id} value={staff.id}>
      {staff.employee_no}　{staff.name}
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
  <option value="">選択してください</option>

  {staffs.map((staff) => (
    <option key={staff.id} value={staff.id}>
      {staff.employee_no}　{staff.name}
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

      <div>
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
          <span>有効</span>
        </label>
      </div>

      <PrimaryButton onClick={handleSubmit}>
  登録する
</PrimaryButton>

    </div>
  </div>
);
}

 