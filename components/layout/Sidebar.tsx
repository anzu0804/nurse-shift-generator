"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }

    const confirmed = window.confirm(
      "ログアウトしますか？"
    );

    if (!confirmed) {
      return;
    }

    try {
      setLoggingOut(true);

      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        alert(
          "ログアウトに失敗しました。もう一度お試しください。"
        );
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      alert(
        "ログアウト中に通信エラーが発生しました。"
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-slate-800 p-6 text-white">
      <h1 className="mb-8 text-2xl font-bold">
        Shift Generator
      </h1>

      <nav className="flex-1 space-y-2">
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

      <div className="border-t border-slate-700 pt-4">
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={loggingOut}
          className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loggingOut
            ? "ログアウト中..."
            : "ログアウト"}
        </button>
      </div>
    </aside>
  );
}