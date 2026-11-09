"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { supabase } from "@/lib/supabase";


type StaffForm = {
  employee_no: string;
  name: string;
  gender: string;
  job_type: string;
  team: string;
  role: string;
  can_night_shift: boolean;
  employment_status: string;
  is_active: boolean;
  joined_date: string;
  retired_date: string;
  remarks: string;
};

export default function StaffEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();

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

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        const { data: sessionData, error: sessionError } =
  await supabase.auth.getSession();

if (sessionError) {
  alert("ログイン状態を確認できません。");
  return;
}

const token = sessionData.session?.access_token;

if (!token) {
  router.push("/login");
  return;
}

const response = await fetch(`/api/staffs/${id}`, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
  cache: "no-store",
});

        if (!response.ok) {
          const errorData = await response.json();
          alert(errorData.error ?? "スタッフ情報の取得に失敗しました");
          return;
        }

        const data = await response.json();

       setForm({
  employee_no: data.employee_no ?? "",
  name: data.name ?? "",
  gender: data.gender ?? "",
  job_type: data.job_type ?? "",
  team: data.team ?? "",
  role: data.role ?? "一般",
  can_night_shift: data.can_night_shift ?? false,
  employment_status: data.employment_status ?? "在籍中",
  is_active: data.is_active ?? true,
  joined_date: data.joined_date ?? "",
  retired_date: data.retired_date ?? "",
  remarks: data.remarks ?? "",
});

      } catch {
        alert("通信に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchStaff();
    }
  }, [id]);

const handleUpdate = async () => {
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

const response = await fetch(`/api/staffs/${id}`, {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify(form),
});

  if (!response.ok) {
    const errorData = await response.json();
    alert(errorData.error ?? "更新に失敗しました");
    return;
  }

  alert("スタッフ情報を更新しました！");

  router.push("/staffs");
  router.refresh();
};

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="スタッフ編集"
        description="スタッフ情報を編集します。"
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

        <PrimaryButton onClick={handleUpdate}>
  更新する
</PrimaryButton>
      </div>
    </div>
  );
}