import "./globals.css";
import type { Metadata } from "next";
import MainLayout from "@/components/layout/MainLayout";

export const metadata: Metadata = {
  title: "看護師シフトジェネレーター",
  description: "看護師シフト作成システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <MainLayout>
          {children}
        </MainLayout>
      </body>
    </html>
  );
}