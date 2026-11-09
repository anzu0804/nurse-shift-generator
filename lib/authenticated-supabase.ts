import { createClient } from "@supabase/supabase-js";

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function getAuthenticatedSupabase(
  request: Request
) {
  const token = request.headers
    .get("Authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];

  if (!token) {
    throw new AuthError("ログインが必要です。", 401);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new AuthError(
      "Supabaseの接続設定が不足しています。",
      500
    );
  }

  const authClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } =
    await authClient.auth.getUser(token);

  if (error) {
    if (error.status === 429) {
      throw new AuthError(
        "認証の試行回数が多いため、少し時間をおいてください。",
        429
      );
    }

    throw new AuthError(
      "ログイン情報を確認できません。ログインし直してください。",
      401
    );
  }

  if (!data.user || data.user.is_anonymous) {
    throw new AuthError(
      "登録済みのアカウントでログインしてください。",
      401
    );
  }

  return createClient(url, anonKey, {
    accessToken: async () => token,
  });
}