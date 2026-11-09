"use client";

import { supabase } from "@/lib/supabase";
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
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw new Error("ログイン状態を確認できません。");
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      router.push("/login");
      return;
    }

    const [pairResponse, staffResponse] =
      await Promise.all([
        fetch(`/api/ng-pairs/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        fetch("/api/staffs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
      ]);

    if (
      pairResponse.status === 401 ||
      staffResponse.status === 401
    ) {
      router.push("/login");
      return;
    }

    const [pair, staffData] = await Promise.all([
      pairResponse.json(),
      staffResponse.json(),
    ]);

    if (!pairResponse.ok) {
      throw new Error(
        pair.error ?? "NGペア情報の取得に失敗しました。"
      );
    }

    if (!staffResponse.ok) {
      throw new Error(
        staffData.error ??
          "スタッフ一覧の取得に失敗しました。"
      );
    }

    setStaffs(Array.isArray(staffData) ? staffData : []);

    setForm({
      staff_a_id: String(pair.staff_a_id),
      staff_b_id: String(pair.staff_b_id),
      reason: pair.reason ?? "",
      is_active: pair.is_active,
    });
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "読み込みに失敗しました。"
    );
  } finally {
    setLoading(false);
  }
};

    fetchData();
  }, [id]);

const handleUpdate = async () => {
  try {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw new Error("ログイン状態を確認できません。");
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      router.push("/login");
      return;
    }

    const response = await fetch(`/api/ng-pairs/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        staff_a_id: Number(form.staff_a_id),
        staff_b_id: Number(form.staff_b_id),
        reason: form.reason,
        is_active: form.is_active,
      }),
    });

    const data = await response.json();

    if (response.status === 401) {
      router.push("/login");
      return;
    }

    if (!response.ok) {
      throw new Error(
        data.error ?? "NGペアの更新に失敗しました。"
      );
    }

    alert("NGペアを更新しました！");

    router.push("/ng-pairs");
    router.refresh();
  } catch (error) {
    alert(
      error instanceof Error
        ? error.message
        : "NGペアの更新に失敗しました。"
    );
  }
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
  <label className="flex items-center gap-3">
    <input
      type="checkbox"
      checked={form.is_active}
      onChange={(e) => {
        const checked = e.currentTarget.checked;

        setForm((prev) => ({
          ...prev,
          is_active: checked,
        }));
      }}
      aria-describedby="ng-pair-active-help"
      className="h-4 w-4"
    />

    <span className="font-medium">
      このNGペアを有効にする
    </span>
  </label>

  <p
    id="ng-pair-active-help"
    className="mt-2 text-sm text-slate-600"
  >
    チェックを外して更新すると、無効になります。
    データは削除されず、後から再び有効にできます。
  </p>
</div>

<PrimaryButton onClick={handleUpdate}>
  更新する
</PrimaryButton>

    </div>
  </div>
);
}