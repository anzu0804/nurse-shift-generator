"use client";

import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { useEffect, useState } from "react";
import Link from "next/link";

type Staff = {
  id: number;
  employee_no: string;
  name: string;
  gender: string;
  job_type: string;
  team: string;
  role: string;
  can_night_shift: boolean;
  employment_status: string;
  display_order: number;
  joined_date: string | null;
  retired_date: string | null;
  remarks: string | null;
};

const getStatusBadgeClass = (status: string) => {
  switch (status) {
    case "在籍中":
      return "bg-green-100 text-green-700";

    case "休職中":
      return "bg-yellow-100 text-yellow-700";

    case "退職済み":
      return "bg-red-100 text-red-700";

    default:
      return "bg-slate-100 text-slate-700";
  }
};

export default function StaffPage() {

    const [searchText, setSearchText] = useState("");

const [sortType, setSortType] = useState<
  "employee_no" | "name" | "display_order"
>("employee_no");

const [statusFilter, setStatusFilter] = useState<
  "在籍中" | "休職中" | "退職済み" | "すべて"
>("在籍中");
    

    const [staffs, setStaffs] = useState<Staff[]>([]);

const [teamFilter, setTeamFilter] = useState("すべて");
const [roleFilter, setRoleFilter] = useState("すべて");
const [jobTypeFilter, setJobTypeFilter] = useState("すべて");
const [nightShiftFilter, setNightShiftFilter] = useState("すべて");
const [genderFilter, setGenderFilter] = useState("すべて");
const [showFilters, setShowFilters] = useState(false);

const fetchStaffs = async () => {
    const response = await fetch("/api/staffs");
    const data = await response.json();
    setStaffs(data);
  };

 const filteredStaffs = staffs
  .filter((staff) => {
    const matchesStatus =
      statusFilter === "すべて" ||
      staff.employment_status === statusFilter;

    const keyword = searchText.trim().toLowerCase();

    const matchesSearch =
      keyword === "" ||
      staff.employee_no.toLowerCase().includes(keyword) ||
      staff.name.toLowerCase().includes(keyword);

    const matchesTeam =
      teamFilter === "すべて" ||
      staff.team === teamFilter;

    const matchesRole =
      roleFilter === "すべて" ||
      staff.role === roleFilter;

    const matchesJobType =
      jobTypeFilter === "すべて" ||
      staff.job_type === jobTypeFilter;

    const matchesGender =
      genderFilter === "すべて" ||
      staff.gender === genderFilter;

    const matchesNightShift =
      nightShiftFilter === "すべて" ||
      (nightShiftFilter === "可" && staff.can_night_shift) ||
      (nightShiftFilter === "不可" && !staff.can_night_shift);

    return (
      matchesStatus &&
      matchesSearch &&
      matchesTeam &&
      matchesRole &&
      matchesJobType &&
      matchesGender &&
      matchesNightShift
    );
  })
  .sort((a, b) => {
    if (sortType === "employee_no") {
      return a.employee_no.localeCompare(
        b.employee_no,
        "ja",
        { numeric: true }
      );
    }

    if (sortType === "name") {
      return a.name.localeCompare(b.name, "ja");
    }

    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

      const activeCount = staffs.filter(
  (staff) => staff.employment_status === "在籍中"
).length;

const leaveCount = staffs.filter(
  (staff) => staff.employment_status === "休職中"
).length;

const retiredCount = staffs.filter(
  (staff) => staff.employment_status === "退職済み"
).length;

useEffect(() => {
  

  fetchStaffs();
}, []);

const handleRetire = async (id: number, name: string) => {
  const isConfirmed = confirm(
  `${name}さんを退職済みに変更します。\n\nこのスタッフはシフト作成対象外になります。\nよろしいですか？`
);

  if (!isConfirmed) {
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  const response = await fetch(`/api/staffs/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      employment_status: "退職済み",
      is_active: false,
      retired_date: today,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "退職処理に失敗しました");
    return;
  }

  alert(`${name}さんを退職済みに変更しました`);

  await fetchStaffs();
};


const handleDelete = async (id: number, name: string) => {
  const isConfirmed = confirm(
    `${name}さんを完全に削除しますか？\nこの操作は元に戻せません。`
  );

  if (!isConfirmed) {
    return;
  }

  const response = await fetch(`/api/staffs/${id}`, {
    method: "DELETE",
  });

  const data = await response.json();

  if (!response.ok) {
    alert(data.error ?? "削除に失敗しました");
    return;
  }

  alert(`${name}さんを削除しました`);

  await fetchStaffs();
};

const handleCsvExport = () => {
  if (filteredStaffs.length === 0) {
    alert("出力できるスタッフがいません");
    return;
  }

  const headers = [
    "社員番号",
    "名前",
    "性別",
    "職種",
    "チーム",
    "役職",
    "夜勤可否",
    "在籍状況",
    "入職日",
    "退職日",
    "備考",
  ];

  const escapeCsv = (
    value: string | number | boolean | null | undefined
  ) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = filteredStaffs.map((staff) => [
    staff.employee_no,
    staff.name,
    staff.gender,
    staff.job_type,
    staff.team,
    staff.role,
    staff.can_night_shift ? "可" : "不可",
    staff.employment_status,
    staff.joined_date ?? "",
    staff.retired_date ?? "",
    staff.remarks ?? "",
  ]);

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) =>
      row.map(escapeCsv).join(",")
    ),
  ].join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    {
      type: "text/csv;charset=utf-8;",
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `スタッフ一覧_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
};

  return (
    <div>
      <PageHeader
  title="スタッフ管理"
  description="スタッフ情報を管理します。"
  
/>

<div className="sticky top-4 z-20 mb-4 flex justify-end">
  <Link href="/staffs/new">
    <PrimaryButton>
      ＋ 新規登録
    </PrimaryButton>
  </Link>
</div>

<div className="mb-6 flex flex-wrap gap-2">
  {[
  {
    label: "在籍中",
    count: activeCount,
  },
  {
    label: "休職中",
    count: leaveCount,
  },
  {
    label: "退職済み",
    count: retiredCount,
  },
  {
    label: "すべて",
    count: staffs.length,
  },
].map((item) => (
  <button
    key={item.label}
    type="button"
    onClick={() =>
      setStatusFilter(
        item.label as
          | "在籍中"
          | "休職中"
          | "退職済み"
          | "すべて"
      )
    }

    
    className={`rounded-lg px-4 py-2 font-medium transition ${
      statusFilter === item.label
        ? "bg-blue-600 text-white"
        : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
    }`}
  >
    {item.label}（{item.count}）
  </button>
))}

<button
  type="button"
  onClick={handleCsvExport}
  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
>
  CSV出力
</button>

</div>

<div className="mb-4 flex flex-wrap items-center gap-3">
  <input
    type="text"
    placeholder="社員番号・名前で検索"
    value={searchText}
    onChange={(e) => setSearchText(e.target.value)}
    className="min-w-[260px] rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none"
  />

  <select
    value={sortType}
    onChange={(e) =>
      setSortType(
        e.target.value as
          | "employee_no"
          | "name"
          | "display_order"
      )
    }
    className="rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none"
  >
    <option value="employee_no">社員番号順</option>
    <option value="name">名前順</option>
  </select>

</div>



<div className="mb-4">
  <button
    type="button"
    onClick={() => setShowFilters(!showFilters)}
    className="mb-3 font-medium text-blue-600 hover:underline"
  >
    {showFilters
      ? "▲ 詳細フィルターを閉じる"
      : "▼ 詳細フィルター"}
  </button>

  {showFilters && (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        
        <select
    value={genderFilter}
    onChange={(e) => setGenderFilter(e.target.value)}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2"
  >
    <option value="すべて">性別：すべて</option>
    <option value="男">男</option>
    <option value="女">女</option>
  </select>

  <select
    value={teamFilter}
    onChange={(e) => setTeamFilter(e.target.value)}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2"
  >

    
    <option value="すべて">チーム：すべて</option>
    <option value="A">A</option>
    <option value="B">B</option>
  </select>

  <select
    value={roleFilter}
    onChange={(e) => setRoleFilter(e.target.value)}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2"
  >
    <option value="すべて">役職：すべて</option>
    <option value="一般">一般</option>
    <option value="リーダー">リーダー</option>
    <option value="主任">主任</option>
    <option value="師長">師長</option>
  </select>

  <select
    value={jobTypeFilter}
    onChange={(e) => setJobTypeFilter(e.target.value)}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2"
  >
    <option value="すべて">職種：すべて</option>
    <option value="正看護師">正看護師</option>
    <option value="補助看護師">補助看護師</option>
    <option value="夜勤バイト">夜勤バイト</option>
  </select>

  <select
    value={nightShiftFilter}
    onChange={(e) => setNightShiftFilter(e.target.value)}
    className="rounded-lg border border-slate-300 bg-white px-4 py-2"
  >
    <option value="すべて">夜勤：すべて</option>
    <option value="可">可</option>
    <option value="不可">不可</option>
  </select>

      </div>

      <button
        type="button"
        onClick={() => {
          setTeamFilter("すべて");
          setRoleFilter("すべて");
          setJobTypeFilter("すべて");
          setNightShiftFilter("すべて");
          setGenderFilter("すべて");
        }}
        className="mt-4 text-sm text-blue-600 hover:underline"
      >
        詳細フィルターをクリア
      </button>
    </div>
  )}
</div>

<p className="mb-3 text-sm text-slate-600">
  表示件数：
  <span className="font-semibold text-slate-900">
    {filteredStaffs.length}
  </span>
  件
</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-slate-100">
  <tr>
    <th className="p-4 text-left">社員番号</th>
    <th className="p-4 text-left">名前</th>
    <th className="p-4 text-left">性別</th>
    <th className="p-4 text-left">職種</th>
    <th className="p-4 text-left">チーム</th>
    <th className="p-4 text-left">役職</th>
    <th className="p-4 text-left">夜勤</th>
    <th className="p-4 text-left">在籍状況</th>
    <th className="p-4 text-left">操作</th>
  </tr>
</thead>

          <tbody>
            {filteredStaffs.map((staff) => (
  <tr
  key={staff.id}
  className={`border-t border-slate-200 ${
    staff.employment_status === "退職済み"
      ? "bg-slate-50 text-slate-400"
      : ""
  }`}
>
    <td className="p-4">
      {staff.employee_no}
    </td>

    <td className="p-4">
      {staff.name}
    </td>

    <td className="p-4">
      {staff.gender || "－"}
    </td>

    <td className="p-4">
      {staff.job_type || "－"}
    </td>

    <td className="p-4">
      <StatusBadge label={staff.team} />
    </td>

    <td className="p-4">
      {staff.role}
    </td>

    <td className="p-4">
      {staff.can_night_shift ? "可" : "不可"}
    </td>

    <td className="p-4">
  <span
    className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStatusBadgeClass(
      staff.employment_status
    )}`}
  >
    {staff.employment_status || "－"}
  </span>
</td>

    <td className="p-4">
  <div className="flex items-center gap-4">
    <Link
      href={`/staffs/${staff.id}`}
      className="text-blue-600 hover:underline"
    >
      編集
    </Link>

   {staff.employment_status === "退職済み" ? (
  <button
    onClick={() => handleDelete(staff.id, staff.name)}
    className="text-red-600 hover:underline"
  >
    削除
  </button>
) : (
  <button
    onClick={() => handleRetire(staff.id, staff.name)}
    className="text-orange-600 hover:underline"
  >
    退職
  </button>
)}
  </div>
</td>

  </tr>
))}
          </tbody>
        </table>
      </div>
    </div>
  );
}