"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";
import { supabase } from "@/lib/supabase";

type Props = {
  children: ReactNode;
};

export default function MainLayout({
  children,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const isLoginPage = pathname === "/login";

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data, error } =
        await supabase.auth.getSession();

      if (!mounted) {
        return;
      }

      if (error) {
        setIsLoggedIn(false);
        setCheckingAuth(false);

        if (!isLoginPage) {
          router.replace("/login");
        }

        return;
      }

      const loggedIn = Boolean(data.session);

      setIsLoggedIn(loggedIn);
      setCheckingAuth(false);

      if (!loggedIn && !isLoginPage) {
        router.replace("/login");
      }

      if (loggedIn && isLoginPage) {
        // ログイン済みならダッシュボードへ
        router.replace("/");
      }
    };

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) {
          return;
        }

        const loggedIn = Boolean(session);

        setIsLoggedIn(loggedIn);
        setCheckingAuth(false);

        if (!loggedIn && pathname !== "/login") {
          router.replace("/login");
        }

        if (loggedIn && pathname === "/login") {
          router.replace("/");
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [isLoginPage, pathname, router]);

  // ログイン画面だけは認証なしで表示
  if (isLoginPage) {
    return (
      <main className="min-h-screen bg-gray-100 p-8">
        {children}
      </main>
    );
  }

  // 認証確認中は管理画面を一瞬でも表示しない
  if (checkingAuth || !isLoggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-100">
        <p className="text-slate-600">
          ログイン状態を確認中です...
        </p>
      </main>
    );
  }

  // ログイン済みだけ管理画面を表示
  return (
    <div className="flex">
      <Sidebar />

      <main className="min-h-screen flex-1 bg-gray-100 p-8">
        {children}
      </main>
    </div>
  );
}