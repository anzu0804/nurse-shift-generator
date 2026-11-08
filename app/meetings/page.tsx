"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";

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

  const fetchMeetings = async () => {
    const response = await fetch("/api/meetings");
    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "会議一覧の取得に失敗しました");
      setMeetings([]);
      return;
    }

    setMeetings(Array.isArray(data) ? data : []);
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
              {meetings.map((meeting) => (
                <tr
                  key={meeting.id}
                  className="border-t border-slate-200"
                >
                  <td className="p-4">
                    {meeting.meeting_name}
                  </td>

                  <td className="p-4">
                    {meeting.meeting_date || "－"}
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

              {meetings.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-slate-500"
                  >
                    会議はまだ登録されていません。
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
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="border-t border-slate-200"
                >
                  <td className="p-4">
                    {event.event_name}
                  </td>

                  <td className="p-4">
                    {event.event_date || "－"}
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

              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    予定はまだ登録されていません。
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