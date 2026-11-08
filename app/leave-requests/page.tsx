"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

type LeaveRequest = {
  id: number;
  staff_id: number;
  leave_date: string;
  leave_type: string;
  status: string;
  note: string | null;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
};

export default function LeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);

  const fetchLeaveRequests = async () => {
    const response = await fetch("/api/leave-requests");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "希望休一覧の取得に失敗しました");
      setLeaveRequests([]);
      return;
    }

    setLeaveRequests(Array.isArray(data) ? data : []);
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
    fetchLeaveRequests();
    fetchStaffs();
  }, []);

  const getStaffName = (staffId: number) => {
    const staff = staffs.find((staff) => staff.id === staffId);

    if (!staff) {
      return `ID: ${staffId}`;
    }

    return `${staff.employee_no} ${staff.name}`;
  };

  const handleDelete = async (id: number) => {
  const isConfirmed = confirm("この希望休を削除しますか？");

  if (!isConfirmed) {
    return;
  }

  const response = await fetch(`/api/leave-requests/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "削除に失敗しました");
    return;
  }

  alert("希望休を削除しました！");
  await fetchLeaveRequests();
};

  return (
    <div>
      <PageHeader
        title="希望休管理"
        description="スタッフの希望休を管理します。"
        action={
          <Link href="/leave-requests/new">
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
              <th className="p-4 text-left">スタッフ</th>
              <th className="p-4 text-left">希望日</th>
              <th className="p-4 text-left">休暇種別</th>
              <th className="p-4 text-left">状態</th>
              <th className="p-4 text-left">備考</th>
              <th className="p-4 text-left">操作</th>
            </tr>
          </thead>

          <tbody>
            {leaveRequests.map((request) => (
              <tr
                key={request.id}
                className="border-t border-slate-200"
              >
                <td className="p-4">
                  {getStaffName(request.staff_id)}
                </td>

                <td className="p-4">
                  {request.leave_date}
                </td>

                <td className="p-4">
                  {request.leave_type}
                </td>

                <td className="p-4">
                  {request.status}
                </td>

                <td className="p-4">
                  {request.note || "－"}
                </td>

                <td className="p-4">
  <div className="flex items-center gap-4">
    <Link
      href={`/leave-requests/${request.id}`}
      className="font-medium text-blue-600 hover:underline"
    >
      編集
    </Link>

    <button
      type="button"
      onClick={() => handleDelete(request.id)}
      className="font-medium text-red-600 hover:underline"
    >
      削除
    </button>
  </div>
</td>
              </tr>
            ))}

            {leaveRequests.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-slate-500"
                >
                  希望休はまだ登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}