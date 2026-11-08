"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

type NgPair = {
  id: number;
  staff_a_id: number;
  staff_b_id: number;
  reason: string | null;
  is_active: boolean;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
};

export default function NgPairsPage() {
  const [pairs, setPairs] = useState<NgPair[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);

  const [statusFilter, setStatusFilter] = useState<
  "すべて" | "有効" | "無効"
>("すべて");

// 選んだ状態に合うNGペアだけを表示する
const filteredPairs = pairs.filter((pair) => {
  if (statusFilter === "有効") {
    return pair.is_active === true;
  }

  if (statusFilter === "無効") {
    return pair.is_active === false;
  }

  return true;
});

// タブに表示する件数
const statusTabs = [
  {
    label: "すべて",
    count: pairs.length,
  },
  {
    label: "有効",
    count: pairs.filter((pair) => pair.is_active === true).length,
  },
  {
    label: "無効",
    count: pairs.filter((pair) => pair.is_active === false).length,
  },
] as const;

  const fetchPairs = async () => {
    const response = await fetch("/api/ng-pairs");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "NGペア一覧の取得に失敗しました");
      setPairs([]);
      return;
    }

    setPairs(Array.isArray(data) ? data : []);
  };

  const fetchStaffs = async () => {
    const response = await fetch("/api/staffs");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "スタッフ一覧の取得に失敗しました");
      setStaffs([]);
      return;
    }

    setStaffs(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchPairs();
    fetchStaffs();
  }, []);

  const getStaffName = (id: number) => {
    const staff = staffs.find((staff) => staff.id === id);

    if (!staff) {
      return `ID: ${id}`;
    }

    return `${staff.employee_no} ${staff.name}`;
  };

  const handleDelete = async (
  id: number,
  reason: string
) => {
  const isConfirmed = confirm(
    `「${reason || "理由なし"}」のNGペアを削除しますか？`
  );

  if (!isConfirmed) {
    return;
  }

  const response = await fetch(`/api/ng-pairs/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "削除に失敗しました");
    return;
  }

  alert("NGペアを削除しました！");

  await fetchPairs();
};

  return (
    <div>
      <PageHeader
        title="NGペア管理"
        description="NGペア情報を管理します。"
        action={
          <Link href="/ng-pairs/new">
            <PrimaryButton>
              ＋ 新規登録
            </PrimaryButton>
          </Link>
        }
      />

<div
  className="mb-4 flex flex-wrap gap-2"
  role="group"
  aria-label="NGペアの状態で絞り込み"
>
  {statusTabs.map((tab) => (
    <button
      key={tab.label}
      type="button"
      onClick={() => setStatusFilter(tab.label)}
      aria-pressed={statusFilter === tab.label}
      className={`rounded-lg border px-4 py-2 font-medium transition ${
        statusFilter === tab.label
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {tab.label}（{tab.count}）
    </button>
  ))}
</div>

<p className="mb-3 text-sm text-slate-600">
  表示件数：
  <span className="font-semibold text-slate-900">
    {filteredPairs.length}
  </span>
  件
</p>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-100">
            <tr>
              <th className="p-4 text-left">スタッフA</th>
              <th className="p-4 text-left">スタッフB</th>
              <th className="p-4 text-left">理由</th>
              <th className="p-4 text-left">状態</th>
              <th className="p-4 text-left">操作</th>
            </tr>
          </thead>

          <tbody>
  {filteredPairs.map((pair) => (
    <tr
      key={pair.id}
      className={`border-t border-slate-200 ${
        pair.is_active
          ? ""
          : "bg-slate-50 text-slate-600"
      }`}
    >
      <td className="p-4">
        {getStaffName(pair.staff_a_id)}
      </td>

      <td className="p-4">
        {getStaffName(pair.staff_b_id)}
      </td>

      <td className="p-4">
        {pair.reason || "－"}
      </td>

      <td className="p-4">
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            pair.is_active
              ? "bg-green-100 text-green-800"
              : "bg-slate-200 text-slate-700"
          }`}
        >
          {pair.is_active ? "有効" : "無効"}
        </span>
      </td>

      <td className="p-4">
        <div className="flex items-center gap-4">
          <Link
            href={`/ng-pairs/${pair.id}`}
            className="font-medium text-blue-600 hover:underline"
          >
            編集
          </Link>

          <button
            type="button"
            onClick={() =>
              handleDelete(pair.id, pair.reason ?? "")
            }
            className="font-medium text-red-600 hover:underline"
          >
            削除
          </button>
        </div>
      </td>
    </tr>
  ))}

  {filteredPairs.length === 0 && (
    <tr>
      <td
        colSpan={5}
        className="p-8 text-center text-slate-500"
      >
        {statusFilter === "すべて"
          ? "NGペアはまだ登録されていません。"
          : `${statusFilter}なNGペアはありません。`}
      </td>
    </tr>
  )}
</tbody>
        </table>
      </div>
    </div>
  );
}