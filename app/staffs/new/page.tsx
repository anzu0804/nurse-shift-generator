"use client";

import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useState } from "react";



export default function NewStaffPage() {

  const [form, setForm] = useState({
  employee_no: "",
  name: "",
  gender: "",
  job_type: "",
  team: "",
  role: "一般",
  can_night_shift: false,
  employment_status: "在籍中",
  is_active: true,
  joined_date: "",
  retired_date: "",
  remarks: "",
});


 const handleSubmit = async () => {
    const response = await fetch("/api/staffs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
  const error = await response.json();
  console.log(error);
  alert(error.error);
  return;
}

    alert("スタッフを登録しました！");

    setForm({
      employee_no: "",
      name: "",
      gender: "",
      job_type: "",
      team: "",
      role: "",
      can_night_shift: false,
      employment_status: "在籍中",
  is_active: true,
  joined_date: "",
  retired_date: "",
  remarks: "",
    });
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="スタッフ登録"
        description="スタッフ情報を登録します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">

        <div>
          <label className="mb-2 block font-medium">
            社員番号
          </label>
          <Input
           placeholder="1001"
           value={form.employee_no}
           onChange={(e) =>
           setForm({
           ...form,
           employee_no: e.target.value,
           })
           }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            名前
          </label>
          <Input
           placeholder="高橋 杏夢"
           value={form.name}
           onChange={(e) =>
           setForm({
           ...form,
           name: e.target.value,
           })
           }
          />
        </div>

        <div>
  <label className="mb-2 block font-medium">
    性別
  </label>

  <Select
    value={form.gender}
    onChange={(e) =>
      setForm({
        ...form,
        gender: e.target.value,
      })
    }
  >
    <option value="">選択してください</option>
    <option value="男">男</option>
    <option value="女">女</option>
  </Select>
</div>

<div>
  <label className="mb-2 block font-medium">
    職種
  </label>

  <Select
    value={form.job_type}
    onChange={(e) =>
      setForm({
        ...form,
        job_type: e.target.value,
      })
    }
  >
    <option value="">選択してください</option>
    <option value="正看護師">正看護師</option>
    <option value="補助看護師">補助看護師</option>
    <option value="夜勤バイト">夜勤バイト</option>
  </Select>
</div>



        <div>
          <label className="mb-2 block font-medium">
            チーム
          </label>

          <Select
           value={form.team}
           onChange={(e) =>
           setForm({
           ...form,
           team: e.target.value,
           })
           }
          >
  <option value="">選択してください</option>
  <option value="A">A</option>
  <option value="B">B</option>
</Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            役職
          </label>

          <Select
           value={form.role}
           onChange={(e) =>
           setForm({
           ...form,
           role: e.target.value,
           })
           }
          >  
 
  <option value="">選択してください</option>
  <option value="一般">一般</option>
  <option value="主任">主任</option>
  <option value="師長">師長</option>
</Select>
        </div>

        <div>
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={form.can_night_shift}
      onChange={(e) =>
        setForm({
          ...form,
          can_night_shift: e.target.checked,
        })
      }
    />

    <span className="font-medium">
      夜勤可能
    </span>
  </label>
</div>

<div>
  <label className="mb-2 block font-medium">
    在籍状況
  </label>

  <Select
    value={form.employment_status}
    onChange={(e) =>
      setForm({
        ...form,
        employment_status: e.target.value,
      })
    }
  >
    <option value="在籍中">在籍中</option>
    <option value="休職中">休職中</option>
    <option value="退職済み">退職済み</option>
  </Select>
</div>

<div>
  <label className="mb-2 block font-medium">
    入職日
  </label>

  <Input
    type="date"
    value={form.joined_date}
    onChange={(e) =>
      setForm({
        ...form,
        joined_date: e.target.value,
      })
    }
  />
</div>

{form.employment_status === "退職済み" && (
  <div>
    <label className="mb-2 block font-medium">
      退職日
    </label>

    <Input
      type="date"
      value={form.retired_date}
      onChange={(e) =>
        setForm({
          ...form,
          retired_date: e.target.value,
        })
      }
    />
  </div>
)}

<div>
  <label className="mb-2 block font-medium">
    備考
  </label>

  <Input
    value={form.remarks}
    onChange={(e) =>
      setForm({
        ...form,
        remarks: e.target.value,
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

        <PrimaryButton onClick={handleSubmit}>
            登録する
        </PrimaryButton>

      </div>
    </div>
  );
}