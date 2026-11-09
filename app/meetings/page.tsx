"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import { supabase } from "@/lib/supabase";
import ScheduleCalendar, {
  getToday,
  subscribeClock,
  serverToday,
  daysInMonth,
  expandDates,
} from "@/components/common/ScheduleCalendar";

type Meeting = {
  id: number;
  meeting_name: string;
  meeting_date: string | null;
  time_period: string | null;
  recurrence_type: string | null;
  recurrence_rule: string | null;
  is_active: boolean;
};

type Event = {
  id: number;
  event_name: string;
  event_date: string | null;
  time_period: string | null;
  recurrence_type: string | null;
  recurrence_rule: string | null;
  event_type: string | null;
  note: string | null;
};

export default function MeetingsPage() {
  const [activeTab, setActiveTab] = useState<"meetings" | "events">(
    "meetings"
  );

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const today = useSyncExternalStore(
  subscribeClock,
  getToday,
  serverToday
);

const [chosenMonth, setChosenMonth] = useState("");
const [selectedDate, setSelectedDate] = useState("");

const scheduleListRef = useRef<HTMLDivElement>(null);

const calendarMonth = chosenMonth || today.slice(0, 7);

const calendarDays = calendarMonth
  ? daysInMonth(calendarMonth)
  : [];

  // 検索・フィルターの選択内容
const [searchText, setSearchText] = useState("");
const [timePeriodFilter, setTimePeriodFilter] = useState("");
const [recurrenceFilter, setRecurrenceFilter] = useState("");
const [meetingStatusFilter, setMeetingStatusFilter] = useState("");
const [eventTypeFilter, setEventTypeFilter] = useState("");

// 全角・半角や英字の大文字・小文字をそろえて検索する
const normalizeSearch = (text: string) =>
  text.normalize("NFKC").toLocaleLowerCase("ja").trim();

const searchWords = normalizeSearch(searchText)
  .split(/\s+/)
  .filter(Boolean);

const matchesSearch = (
  values: Array<string | null | undefined>
) => {
  const text = normalizeSearch(
    values.map((value) => value ?? "").join(" ")
  );

  return searchWords.every((word) => text.includes(word));
};

// 会議：名前・繰り返し条件・時間帯・有効／無効で絞り込む
const filteredMeetings = meetings.filter((meeting) => {
  return (
    matchesSearch([
      meeting.meeting_name,
      meeting.recurrence_rule,
    ]) &&
    (!timePeriodFilter ||
      meeting.time_period === timePeriodFilter) &&
    (!recurrenceFilter ||
      (meeting.recurrence_type?.trim() || "なし") ===
        recurrenceFilter) &&
    (!meetingStatusFilter ||
      meeting.is_active === (meetingStatusFilter === "true"))
  );
});

// 予定：名前・種別・繰り返し条件・備考などで絞り込む
const filteredEvents = events.filter((event) => {
  return (
    matchesSearch([
      event.event_name,
      event.event_type,
      event.recurrence_rule,
      event.note,
    ]) &&
    (!timePeriodFilter ||
      event.time_period === timePeriodFilter) &&
    (!recurrenceFilter ||
      (event.recurrence_type?.trim() || "なし") ===
        recurrenceFilter) &&
    (!eventTypeFilter ||
      event.event_type === eventTypeFilter)
  );
});

// 登録済みのイベント種別を、フィルターの選択肢にする
const eventTypeOptions = Array.from(
  new Set(
    events
      .map((event) => event.event_type)
      .filter(
        (value): value is string =>
          typeof value === "string" && value !== ""
      )
  )
).sort((a, b) => a.localeCompare(b, "ja"));

// 検索・フィルター適用後の会議をカレンダー形式に変換
const meetingCalendarItems = filteredMeetings.map((meeting) => ({
  id: meeting.id,
  title: meeting.meeting_name,
  date: meeting.meeting_date,
  time_period: meeting.time_period,
  recurrence_type: meeting.recurrence_type,
  recurrence_rule: meeting.recurrence_rule,
  is_active: meeting.is_active,
  href: `/meetings/${meeting.id}`,
  source: meeting,
}));

// 検索・フィルター適用後の予定をカレンダー形式に変換
const eventCalendarItems = filteredEvents.map((event) => ({
  id: event.id,
  title: event.event_name,
  date: event.event_date,
  time_period: event.time_period,
  recurrence_type: event.recurrence_type,
  recurrence_rule: event.recurrence_rule,
  href: `/events/${event.id}`,
  source: event,
}));

// 表示月の開催日ごとに、会議の一覧行を作る
const visibleMeetings = meetingCalendarItems
  .flatMap((item) => {
    const { dates } = expandDates(
      item,
      calendarMonth,
      calendarDays
    );

    return dates
      .filter((date) => !selectedDate || date === selectedDate)
      .map((date) => ({
        ...item.source,
        occurrence_date: date,
      }));
  })
  .sort(
    (a, b) =>
      a.occurrence_date.localeCompare(b.occurrence_date) ||
      a.id - b.id
  );

// 表示月の開催日ごとに、予定の一覧行を作る
const visibleEvents = eventCalendarItems
  .flatMap((item) => {
    const { dates } = expandDates(
      item,
      calendarMonth,
      calendarDays
    );

    return dates
      .filter((date) => !selectedDate || date === selectedDate)
      .map((date) => ({
        ...item.source,
        occurrence_date: date,
      }));
  })
  .sort(
    (a, b) =>
      a.occurrence_date.localeCompare(b.occurrence_date) ||
      a.id - b.id
  );

  const fetchMeetings = async () => {
  try {
    // ブラウザでログインしたセッションからトークンを取り出す
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) {
      throw new Error(
        "ログイン状態を確認できません。ログイン画面を開き直してください。"
      );
    }

    const token = sessionData.session?.access_token;

    if (!token) {
      setMeetings([]);
      window.location.assign("/login");
      return;
    }

    // 自分のアプリのAPIへ、ログイン情報を添えて送る
    const response = await fetch("/api/meetings", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      redirect: "error",
    });

    if (response.status === 401) {
      setMeetings([]);
      window.location.assign("/login");
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        typeof data?.error === "string"
          ? data.error
          : "会議一覧の取得に失敗しました。"
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("会議一覧のデータ形式を確認できません。");
    }

    setMeetings(data);
  } catch (error) {
    setMeetings([]);

    alert(
      error instanceof Error
        ? error.message
        : "会議一覧の取得に失敗しました。"
    );
  }
};

  const fetchEvents = async () => {
    const response = await fetch("/api/events");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "予定一覧の取得に失敗しました");
      setEvents([]);
      return;
    }

    setEvents(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchMeetings();
    fetchEvents();
  }, []);

  const handleDeleteMeeting = async (id: number) => {
    const isConfirmed = confirm("この会議を削除しますか？");

    if (!isConfirmed) {
      return;
    }

    const response = await fetch(`/api/meetings/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "会議の削除に失敗しました");
      return;
    }

    alert("会議を削除しました！");

    await fetchMeetings();
  };

  const handleDeleteEvent = async (id: number) => {
    const isConfirmed = confirm("この予定を削除しますか？");

    if (!isConfirmed) {
      return;
    }

    const response = await fetch(`/api/events/${id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "予定の削除に失敗しました");
      return;
    }

    alert("予定を削除しました！");

    await fetchEvents();
  };

  return (
    <div>
      <PageHeader
        title="会議・予定管理"
        description="会議と病棟予定を管理します。"
        action={
          activeTab === "meetings" ? (
            <Link href="/meetings/new">
              <PrimaryButton>
                ＋ 会議を登録
              </PrimaryButton>
            </Link>
          ) : (
            <Link href="/events/new">
              <PrimaryButton>
                ＋ 予定を登録
              </PrimaryButton>
            </Link>
          )
        }
      />

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("meetings")}
          className={`border-b-2 px-6 py-3 font-medium ${
            activeTab === "meetings"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          会議
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("events")}
          className={`border-b-2 px-6 py-3 font-medium ${
            activeTab === "events"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          予定
        </button>
      </div>

<ScheduleCalendar
  label={activeTab === "meetings" ? "会議" : "予定"}
  items={
    activeTab === "meetings"
      ? meetingCalendarItems
      : eventCalendarItems
  }
  month={calendarMonth}
  today={today}
  selectedDate={selectedDate}
  onMonthChange={(value) => {
    setChosenMonth(value);
    setSelectedDate("");
  }}
  onSelectDate={(date) => {
    setSelectedDate(date);

    scheduleListRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }}
/>

<div
  ref={scheduleListRef}
  className="mb-4 flex scroll-mt-4 flex-wrap items-center justify-between gap-3"
>
  <div>
    <h2 className="text-xl font-bold text-slate-900">
      {selectedDate
        ? `${selectedDate.replaceAll("-", "/")}の一覧`
        : calendarMonth
          ? `${Number(calendarMonth.slice(0, 4))}年${Number(
              calendarMonth.slice(5, 7)
            )}月の一覧`
          : "一覧"}
    </h2>

    <p className="mt-1 text-sm text-slate-600">
      繰り返し予定は開催日ごとに表示します。
      編集・削除は、その日だけではなく登録全体に適用されます。
    </p>
  </div>

  {selectedDate && (
    <button
      type="button"
      onClick={() => setSelectedDate("")}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-50"
    >
      日付の選択を解除
    </button>
  )}
</div>

<div className="mb-4 space-y-4 rounded-xl border border-slate-200 bg-white p-4">
  <label className="block">
    <span className="mb-1 block text-sm font-medium">
      検索
    </span>

    <input
      type="search"
      value={searchText}
      onChange={(e) => setSearchText(e.target.value)}
      placeholder={
        activeTab === "meetings"
          ? "会議名・繰り返し条件で検索"
          : "予定名・種別・繰り返し条件・備考で検索"
      }
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
    />
  </label>

  <div className="grid gap-3 sm:grid-cols-3">
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        時間帯
      </span>

      <select
        value={timePeriodFilter}
        onChange={(e) => setTimePeriodFilter(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        <option value="">すべて</option>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
        <option value="終日">終日</option>
      </select>
    </label>

    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        繰り返し
      </span>

      <select
        value={recurrenceFilter}
        onChange={(e) => setRecurrenceFilter(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
      >
        <option value="">すべて</option>
        <option value="なし">なし</option>
        <option value="毎週">毎週</option>
        <option value="毎月">毎月</option>
      </select>
    </label>

    {activeTab === "meetings" ? (
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          会議の状態
        </span>

        <select
          value={meetingStatusFilter}
          onChange={(e) =>
            setMeetingStatusFilter(e.target.value)
          }
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="">すべて</option>
          <option value="true">有効</option>
          <option value="false">無効</option>
        </select>
      </label>
    ) : (
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          イベント種別
        </span>

        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
        >
          <option value="">すべて</option>

          {eventTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>

  <div className="flex flex-wrap items-center justify-between gap-3">
    <button
      type="button"
      onClick={() => {
        setSearchText("");
        setTimePeriodFilter("");
        setRecurrenceFilter("");
        setMeetingStatusFilter("");
        setEventTypeFilter("");
      }}
      className="text-sm font-medium text-blue-600 hover:underline"
    >
      検索・フィルターをクリア
    </button>

   <p className="text-sm text-slate-600">
  一覧：
  <span className="font-semibold text-slate-900">
    {activeTab === "meetings"
      ? visibleMeetings.length
      : visibleEvents.length}
  </span>
  件
  {selectedDate
    ? "（選択日の開催件数）"
    : "（表示月の開催件数）"}
</p>
  </div>
</div>

      {activeTab === "meetings" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-4 text-left">会議名</th>
                <th className="p-4 text-left">開催日</th>
                <th className="p-4 text-left">時間帯</th>
                <th className="p-4 text-left">繰り返し</th>
                <th className="p-4 text-left">状態</th>
                <th className="p-4 text-left">操作</th>
              </tr>
            </thead>

            <tbody>
              {visibleMeetings.map((meeting) => (
                <tr
                  key={`${meeting.id}:${meeting.occurrence_date}`}
                  className="border-t border-slate-200"
                >
                  <td className="p-4">
                    {meeting.meeting_name}
                  </td>

                  <td className="p-4">
                   {meeting.occurrence_date.replaceAll("-", "/")}
                  </td>

                  <td className="p-4">
                    {meeting.time_period || "－"}
                  </td>

                  <td className="p-4">
                    {meeting.recurrence_type || "なし"}
                  </td>

                  <td className="p-4">
                    {meeting.is_active ? "有効" : "無効"}
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/meetings/${meeting.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        編集
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteMeeting(meeting.id)
                        }
                        className="font-medium text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

             {visibleMeetings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-slate-500"
                  >
                    条件に一致する会議はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "events" && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-4 text-left">予定名</th>
                <th className="p-4 text-left">開催日</th>
                <th className="p-4 text-left">時間帯</th>
                <th className="p-4 text-left">種別</th>
                <th className="p-4 text-left">繰り返し</th>
                <th className="p-4 text-left">備考</th>
                <th className="p-4 text-left">操作</th>
              </tr>
            </thead>

            <tbody>
             {visibleEvents.map((event) => (
                <tr
                  key={`${event.id}:${event.occurrence_date}`}
                  className="border-t border-slate-200"
                >
                  <td className="p-4">
                    {event.event_name}
                  </td>

                  <td className="p-4">
                   {event.occurrence_date.replaceAll("-", "/")}
                  </td>

                  <td className="p-4">
                    {event.time_period || "－"}
                  </td>

                  <td className="p-4">
                    {event.event_type || "－"}
                  </td>

                  <td className="p-4">
                    {event.recurrence_type || "なし"}
                  </td>

                  <td className="p-4">
                    {event.note || "－"}
                  </td>

                  <td className="p-4">
                    <div className="flex items-center gap-4">
                      <Link
                        href={`/events/${event.id}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        編集
                      </Link>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteEvent(event.id)
                        }
                        className="font-medium text-red-600 hover:underline"
                      >
                        削除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

             {visibleEvents.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    条件に一致する予定はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}