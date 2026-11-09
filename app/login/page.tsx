"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // ボタンの連打による二重送信を防ぐ
  const busyRef = useRef(false);

  // 初期状態・ログイン・ログアウトを画面に反映する
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setChecking(false);
      }
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busyRef.current) {
      return;
    }

    const trimmedEmail = email.trim();

    if (!trimmedEmail || !password) {
      setErrorMessage(
        "メールアドレスとパスワードを入力してください。"
      );
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setErrorMessage("");

    try {
      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

      if (error) {
        if (error.code === "invalid_credentials") {
          setErrorMessage(
            "メールアドレスまたはパスワードを確認してください。"
          );
        } else if (error.code === "email_not_confirmed") {
          setErrorMessage(
            "メールアドレスが未確認です。Supabaseのユーザー設定を確認してください。"
          );
        } else if (error.status === 429) {
          setErrorMessage(
            "試行回数が多いため、少し時間をおいてから再度お試しください。"
          );
        } else {
          setErrorMessage(
            "ログインできませんでした。接続状態と認証設定を確認してください。"
          );
        }

        return;
      }

      if (!data.user || !data.session) {
        setErrorMessage(
          "ログイン結果を確認できませんでした。もう一度お試しください。"
        );
        return;
      }

      setUser(data.user);
      setPassword("");
    } catch {
      setErrorMessage(
        "通信に失敗しました。インターネット接続を確認してください。"
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (busyRef.current) {
      return;
    }

    busyRef.current = true;
    setBusy(true);
    setErrorMessage("");

    try {
      // 今のログインセッションを終了する
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        setErrorMessage(
          "ログアウトできませんでした。もう一度お試しください。"
        );
        return;
      }

      setUser(null);
      setPassword("");
    } catch {
      setErrorMessage(
        "通信に失敗しました。接続状態を確認してください。"
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <h1 className="text-3xl font-bold text-slate-900">
        ログイン
      </h1>

      <p className="mt-2 text-sm text-slate-600">
        登録済みのアカウントでログインしてください。
      </p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {errorMessage && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {errorMessage}
          </p>
        )}

        {checking ? (
          <p role="status" className="text-slate-600">
            ログイン状態を確認中です…
          </p>
        ) : user ? (
          <div className="space-y-4">
            <div
              role="status"
              className="rounded-lg bg-green-50 p-4 text-green-800"
            >
              <p className="font-semibold">
                ログイン済みです。
              </p>

              <p className="mt-1 break-all text-sm">
                {user.email}
              </p>
            </div>

            <p className="text-sm text-slate-600">
              今回はログインの確認までです。
              会議の取得・保存APIへの接続は、次の手順で設定します。
            </p>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={busy}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "処理中…" : "ログアウト"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <fieldset disabled={busy} className="space-y-5">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-2 block font-medium"
                >
                  メールアドレス
                </label>

                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="mb-2 block font-medium"
                >
                  パスワード
                </label>

                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "ログイン中…" : "ログイン"}
              </button>
            </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}