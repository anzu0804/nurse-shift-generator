import Link from "next/link";

const menus = [
  { href: "/dashboard", label: "ダッシュボード" },
  { href: "/staffs", label: "スタッフ管理" },
  { href: "/ng-pairs", label: "NGペア管理" },
  { href: "/leave-requests", label: "希望休管理" },
  { href: "/meetings", label: "会議・予定管理" },
  { href: "/conditions", label: "条件管理" },
  { href: "/shift-create", label: "シフト作成" },
  { href: "/shift-edit", label: "シフト編集" },
  { href: "/export", label: "出力" },
  { href: "/public-holidays", label: "公休確認" },
];

export default function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-slate-800 text-white p-6">
      <h1 className="text-2xl font-bold mb-8">
        Shift Generator
      </h1>

      <nav className="space-y-2">
        {menus.map((menu) => (
          <Link
            key={menu.href}
            href={menu.href}
            className="block rounded-md px-3 py-2 hover:bg-slate-700"
          >
            {menu.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}