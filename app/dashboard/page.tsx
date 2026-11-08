const dashboardCards = [
  {
    label: "スタッフ数",
    value: "0人",
    description: "登録されているスタッフ",
  },
  {
    label: "NGペア数",
    value: "0件",
    description: "登録されているNGペア",
  },
  {
    label: "残前公休数",
    value: "0日",
    description: "スタッフ全体の残前公休",
  },
  {
    label: "今月のシフト",
    value: "未作成",
    description: "シフト表の作成状況",
  },
];

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          ダッシュボード
        </h1>

        <p className="mt-2 text-sm text-slate-600">
          シフト作成に必要な情報と進捗を確認できます。
        </p>
      </div>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {dashboardCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {card.label}
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {card.value}
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {card.description}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}