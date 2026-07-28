import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("staffs")
    .select("*");

  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold mb-4">
        看護師シフトジェネレーター
      </h1>

      <h2 className="text-xl mb-2">Supabase接続確認</h2>

      <pre className="bg-gray-100 p-4 rounded">
        {JSON.stringify({ data, error }, null, 2)}
      </pre>
    </main>
  );
}