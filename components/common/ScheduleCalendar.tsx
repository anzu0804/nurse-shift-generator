"use client";
import Link from "next/link";

type CalendarItem = {
  id: number;
  title: string;
  date: string | null;
  time_period: string | null;
  recurrence_type: string | null;
  recurrence_rule: string | null;
  href: string;
  is_active?: boolean;
};

type Props = {
  items: CalendarItem[];
  label: "会議" | "予定";
  month: string;
  today: string;
  selectedDate: string;
  onMonthChange: (month: string) => void;
  onSelectDate: (date: string) => void;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40";

// 日本時間の今日を取得する
function getToday() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (type: string) =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function subscribeClock(notify: () => void) {
  const timer = window.setInterval(notify, 60_000);
  return () => window.clearInterval(timer);
}

function serverToday() {
  return "";
}

// 存在する日付か確認する
function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const year = Number(value.slice(0, 4));
  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    year < 100 ||
    year > 9998 ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    return null;
  }

  return date;
}

// 表示月の日付一覧を作る
function daysInMonth(month: string) {
  const [year, number] = month.split("-").map(Number);

  const count = new Date(
    Date.UTC(year, number, 0)
  ).getUTCDate();

  return Array.from(
    { length: count },
    (_, index) =>
      `${month}-${String(index + 1).padStart(2, "0")}`
  );
}

function moveMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);

  return new Date(
    Date.UTC(year, number - 1 + offset, 1)
  )
    .toISOString()
    .slice(0, 7);
}

// 表示する開催日を計算する。
// DBに予定を追加したり、保存済みデータを書き換えたりはしない。
function expandDates(
  item: CalendarItem,
  month: string,
  days: string[]
) {
  const start = item.date?.trim() || "";
  const repeat = item.recurrence_type?.trim() || "なし";

  const rule = (item.recurrence_rule ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "");

  const invalid = (message: string) => ({
    dates: [] as string[],
    warning: `${item.title}：${message}`,
  });

  if (start && !parseDate(start)) {
    return invalid("開催日が正しくありません。");
  }

  if (repeat === "なし") {
    if (!start) {
      return invalid("開催日が未入力です。");
    }

    return {
      dates: start.startsWith(`${month}-`) ? [start] : [],
      warning: null,
    };
  }

  let matches: (date: string) => boolean;

  if (repeat === "毎週") {
    const match = rule.match(
      /^(?:毎週)?([日月火水木金土])(?:曜日|曜)?$/
    );

    if (!match) {
      return invalid(
        "繰り返し条件を「毎週火曜日」などで入力してください。"
      );
    }

    const weekday = WEEKDAYS.indexOf(match[1]);

    matches = (date) =>
      parseDate(date)!.getUTCDay() === weekday;
  } else if (repeat === "毎月") {
    const nth = rule.match(
      /^(?:毎月)?第([1-5])([日月火水木金土])(?:曜日|曜)?$/
    );

    const fixed = rule.match(
      /^(?:毎月)?([1-9]|[12]\d|3[01])日$/
    );

    if (nth) {
      const week = Number(nth[1]);
      const weekday = WEEKDAYS.indexOf(nth[2]);

      matches = (date) =>
        parseDate(date)!.getUTCDay() === weekday &&
        Math.floor((Number(date.slice(8)) - 1) / 7) + 1 ===
          week;
    } else if (fixed) {
      const day = Number(fixed[1]);

      matches = (date) =>
        Number(date.slice(8)) === day;
    } else {
      return invalid(
        "繰り返し条件を「第1月曜日」または「毎月15日」などで入力してください。"
      );
    }
  } else {
    return invalid(
      `繰り返し「${repeat}」には対応していません。`
    );
  }

  // 開催日がある場合は、その日を開始日として扱う。
  // 開催日が空の場合は、表示月内の該当日に表示する。
  return {
    dates: days.filter(
      (date) => (!start || date >= start) && matches(date)
    ),
    warning: null,
  };
}

export default function ScheduleCalendar({
  items,
  label,
  month,
  today,
  selectedDate,
  onMonthChange,
  onSelectDate,
}: Props) {

  if (!month) {
    return (
      <p role="status" className="mb-6">
        カレンダーを準備しています…
      </p>
    );
  }

  const days = daysInMonth(month);
  const firstWeekday = parseDate(days[0])!.getUTCDay();

  const cellCount =
    Math.ceil((firstWeekday + days.length) / 7) * 7;

  const cells = Array.from(
    { length: cellCount },
    (_, index) => days[index - firstWeekday] ?? null
  );

  const byDate = new Map<string, CalendarItem[]>();

  const warnings: {
    key: string;
    message: string;
  }[] = [];

  for (const item of items) {
    const result = expandDates(item, month, days);

    if (result.warning) {
      warnings.push({
        key: item.href,
        message: result.warning,
      });
    }

    for (const date of result.dates) {
      const list = byDate.get(date) ?? [];
      list.push(item);
      byDate.set(date, list);
    }
  }

  const periodOrder: Record<string, number> = {
    終日: 0,
    AM: 1,
    PM: 2,
  };

  for (const list of byDate.values()) {
    list.sort(
      (a, b) =>
        (periodOrder[a.time_period ?? ""] ?? 3) -
          (periodOrder[b.time_period ?? ""] ?? 3) ||
        a.title.localeCompare(b.title, "ja") ||
        a.id - b.id
    );
  }

  const renderItem = (item: CalendarItem, date: string) => (
    <Link
      key={`${item.href}:${date}`}
      href={item.href}
      title={`${item.title} / ${
        item.time_period || "時間帯未設定"
      }`}
      className={`block rounded border px-2 py-1 text-xs hover:brightness-95 ${
        item.is_active === false
          ? "border-slate-200 bg-slate-100 text-slate-600"
          : label === "会議"
            ? "border-blue-200 bg-blue-50 text-blue-900"
            : "border-emerald-200 bg-emerald-50 text-emerald-900"
      }`}
    >
      <span className="block truncate font-medium">
        {item.title}
      </span>

      <span className="block">
        {item.time_period || "時間帯未設定"}
        {item.is_active === false ? "・無効" : ""}
        {item.recurrence_type &&
        item.recurrence_type !== "なし"
          ? "・繰返"
          : ""}
      </span>
    </Link>
  );

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-900">
          {Number(month.slice(0, 4))}年
          {Number(month.slice(5))}月の{label}
        </h2>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonClass}
            disabled={month <= "0100-01"}
            onClick={() =>
              onMonthChange(moveMonth(month, -1))
            }
          >
            前月
          </button>

          <input
            type="month"
            aria-label="カレンダーの表示月"
            min="0100-01"
            max="9998-12"
            value={month}
            onChange={(e) => {
              const value = e.target.value;

              if (
                value.length === 7 &&
                parseDate(`${value}-01`)
              ) {
                onMonthChange(value);
              }
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />

          <button
            type="button"
            className={buttonClass}
            disabled={month >= "9998-12"}
            onClick={() =>
              onMonthChange(moveMonth(month, 1))
            }
          >
            翌月
          </button>

          <button
            type="button"
            className={buttonClass}
            onClick={() => onMonthChange("")}
          >
            今月
          </button>
        </div>
      </div>

      <p className="mb-3 text-sm text-slate-600">
        名前を押すと編集画面を開きます。
        繰り返し予定の編集は、その日のみではなく登録全体に適用されます。
        無効な会議も、灰色で表示します。
      </p>

      {warnings.length > 0 && (
        <div
          role="alert"
          className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
        >
          <p className="font-semibold">
            次の登録は開催日を計算できないため、
            カレンダーに表示していません。
          </p>

          {warnings.map((warning) => (
            <p key={warning.key} className="mt-1">
              {warning.message}
            </p>
          ))}

          <p className="mt-2">
            下の一覧の「編集」から内容を確認してください。
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 border-l border-t border-slate-200">
            {WEEKDAYS.map((day, index) => (
              <div
                key={day}
                className={`border-b border-r border-slate-200 bg-slate-50 p-2 text-center text-sm font-semibold ${
                  index === 0
                    ? "text-red-700"
                    : index === 6
                      ? "text-blue-700"
                      : "text-slate-700"
                }`}
              >
                {day}
              </div>
            ))}

            {cells.map((date, index) => {
              const entries = date
                ? byDate.get(date) ?? []
                : [];

              return (
                <div
                  key={date ?? `empty-${index}`}
                  className={`min-h-36 border-b border-r border-slate-200 p-2 ${
                    !date
                      ? "bg-slate-50"
                      : date === today
                        ? "bg-amber-50"
                        : "bg-white"
                  }`}
                >
                  {date && (
                    <>
                      <button
  type="button"
  onClick={() => onSelectDate(date)}
  aria-pressed={selectedDate === date}
  aria-label={`${date}の一覧を表示`}
  className={`mb-2 w-full rounded px-1 py-1 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-600 ${
    selectedDate === date
      ? "bg-blue-600 text-white"
      : index % 7 === 0
        ? "text-red-700 hover:bg-slate-100"
        : index % 7 === 6
          ? "text-blue-700 hover:bg-slate-100"
          : "text-slate-800 hover:bg-slate-100"
  }`}
>
  {Number(date.slice(8))}
  {date === today ? "（今日）" : ""}
</button>

                      <div className="space-y-1">
                        {entries
                          .slice(0, 3)
                          .map((item) =>
                            renderItem(item, date)
                          )}

                        {entries.length > 3 && (
                          <details>
                            <summary className="cursor-pointer py-1 text-xs text-blue-700">
                              ほか{entries.length - 3}件
                            </summary>

                            <div className="space-y-1">
                              {entries
                                .slice(3)
                                .map((item) =>
                                  renderItem(item, date)
                                )}
                            </div>
                          </details>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export {
  getToday,
  subscribeClock,
  serverToday,
  daysInMonth,
  expandDates,
};