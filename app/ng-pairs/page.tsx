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
            {pairs.map((pair) => (
              <tr
                key={pair.id}
                className="border-t border-slate-200"
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
                  {pair.is_active ? "有効" : "無効"}
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


            {pairs.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-slate-500"
                >
                  NGペアはまだ登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}