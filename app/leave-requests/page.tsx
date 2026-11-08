"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/common/PageHeader";

type LeaveRequest = {
  id: number;
  staff_id: number;
  leave_date: string;
  leave_type: string;
  status: string;
  note: string | null;
};

type Staff = {
  id: number;
  employee_no: string;
  name: string;
  team?: string | null;
};

type SortOrder = "date-asc" | "date-desc" | "staff";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const LEAVE_TYPES = ["有給", "生理休暇", "夏休み", "誕生日"];
const STATUSES = ["申請済み", "確定", "取消"];

const buttonClass =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

// ---------- 取得データの確認 ----------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isLeaveRequest(value: unknown): value is LeaveRequest {
  return (
    isRecord(value) &&
    isPositiveId(value.id) &&
    isPositiveId(value.staff_id) &&
    typeof value.leave_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.leave_date) &&
    typeof value.leave_type === "string" &&
    typeof value.status === "string" &&
    (value.note === null || typeof value.note === "string")
  );
}

function isStaff(value: unknown): value is Staff {
  return (
    isRecord(value) &&
    isPositiveId(value.id) &&
    typeof value.employee_no === "string" &&
    typeof value.name === "string" &&
    (value.team == null || typeof value.team === "string")
  );
}

function readLeaves(value: unknown): LeaveRequest[] {
  if (!Array.isArray(value) || !value.every(isLeaveRequest)) {
    throw new Error(
      "希望休データの形式を確認できません。一覧を再読み込みしてください。"
    );
  }

  return value;
}

async function fetchJson(
  url: string,
  options: RequestInit = {}
): Promise<unknown> {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
  });

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new Error(
      `APIの応答を読み取れませんでした（HTTP ${response.status}）。`
    );
  }

  if (!response.ok) {
    const message =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : `データの取得・保存に失敗しました（HTTP ${response.status}）。`;

    throw new Error(message);
  }

  return body;
}

// ---------- 日付・表示用の処理 ----------

function getTokyoToday(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const part = (name: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === name)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function displayDate(value: string): string {
  return value.replaceAll("-", "/");
}

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1, 12);

  return (
    `${String(date.getFullYear()).padStart(4, "0")}-` +
    `${String(date.getMonth() + 1).padStart(2, "0")}`
  );
}

function calendarDates(month: string): (string | null)[] {
  const [year, monthNumber] = month.split("-").map(Number);

  const firstWeekday = new Date(year, monthNumber - 1, 1, 12).getDay();
  const days = new Date(year, monthNumber, 0, 12).getDate();
  const cells = Math.ceil((firstWeekday + days) / 7) * 7;

  return Array.from({ length: cells }, (_, index) => {
    const day = index - firstWeekday + 1;

    if (day < 1 || day > days) {
      return null;
    }

    return `${month}-${String(day).padStart(2, "0")}`;
  });
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("ja").trim();
}

function leaveClass(type: string): string {
  switch (type) {
    case "有給":
      return "border-sky-200 bg-sky-50 text-sky-800";
    case "生理休暇":
      return "border-rose-200 bg-rose-50 text-rose-800";
    case "夏休み":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "誕生日":
      return "border-violet-200 bg-violet-50 text-violet-800";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function statusClass(status: string): string {
  if (status === "確定") {
    return "bg-green-100 text-green-800";
  }

  if (status === "申請済み") {
    return "bg-amber-100 text-amber-900";
  }

  return "bg-slate-100 text-slate-600";
}

// ---------- 希望休管理画面 ----------

export default function LeaveRequestsPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);

  const [requestedMonth, setRequestedMonth] = useState("");
  const [month, setMonth] = useState("");
  const [today, setToday] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const [searchText, setSearchText] = useState("");
  const [staffFilter, setStaffFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("date-asc");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deletingRef = useRef(false);
  const listRef = useRef<HTMLElement>(null);

  // 表示月の希望休と、スタッフ一覧を取得する
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const currentDay = getTokyoToday();
    const targetMonth = requestedMonth || currentDay.slice(0, 7);

    async function loadData() {
      try {
        const [leaveData, staffData] = await Promise.all([
          fetchJson(`/api/leave-requests?month=${targetMonth}`, {
            signal: controller.signal,
          }),
          fetchJson("/api/staffs", {
            signal: controller.signal,
          }),
        ]);

        const rows = readLeaves(leaveData);

        if (!Array.isArray(staffData) || !staffData.every(isStaff)) {
          throw new Error("スタッフ一覧の形式を確認できません。");
        }

        if (!cancelled) {
          setLeaveRequests(rows);
          setStaffs(staffData);
          setError("");
        }
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "通信に失敗しました。"
          );
        }
      } finally {
        if (!cancelled) {
          setToday(currentDay);
          setMonth(targetMonth);
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [requestedMonth, reloadKey]);

  const staffMap = new Map(staffs.map((staff) => [staff.id, staff]));

  const staffName = (id: number) => {
    const staff = staffMap.get(id);

    return staff
      ? `${staff.employee_no} ${staff.name}`
      : `スタッフID：${id}（詳細取得不可）`;
  };

  const staffOptions = [...staffs].sort((a, b) =>
    a.employee_no.localeCompare(b.employee_no, "ja", {
      numeric: true,
    })
  );

  const types = Array.from(
    new Set([
      ...LEAVE_TYPES,
      ...leaveRequests.map((row) => row.leave_type),
    ])
  );

  const statuses = Array.from(
    new Set([
      ...STATUSES,
      ...leaveRequests.map((row) => row.status),
    ])
  );

  const teams = Array.from(
    new Set(
      staffs
        .map((staff) => staff.team)
        .filter((team): team is string => Boolean(team))
    )
  ).sort();

  const keywords = normalizeText(searchText)
    .split(/\s+/)
    .filter(Boolean);

  // 検索・フィルターは、カレンダーと一覧の両方に反映する
  const filteredMonthRequests = leaveRequests.filter((row) => {
    const staff = staffMap.get(row.staff_id);

    const text = normalizeText(
      `${staffName(row.staff_id)} ` +
        `${staff?.name.replace(/\s+/g, "") ?? ""} ` +
        `${row.note ?? ""}`
    );

    return (
      row.leave_date.startsWith(`${month}-`) &&
      keywords.every((word) => text.includes(word)) &&
      (!staffFilter || String(row.staff_id) === staffFilter) &&
      (!teamFilter || staff?.team === teamFilter) &&
      (!typeFilter || row.leave_type === typeFilter) &&
      (!statusFilter || row.status === statusFilter)
    );
  });

  // カレンダー表示用に日付ごとにまとめる
  const requestsByDate = new Map<string, LeaveRequest[]>();

  for (const row of filteredMonthRequests) {
    const entries = requestsByDate.get(row.leave_date) ?? [];
    entries.push(row);
    requestsByDate.set(row.leave_date, entries);
  }

  // 日付を選択した場合は、下の一覧だけをその日に絞る
  const filteredRequests = filteredMonthRequests
    .filter((row) => !selectedDate || row.leave_date === selectedDate)
    .sort((a, b) => {
      if (sortOrder === "staff") {
        return (
          staffName(a.staff_id).localeCompare(
            staffName(b.staff_id),
            "ja",
            { numeric: true }
          ) ||
          a.leave_date.localeCompare(b.leave_date) ||
          a.id - b.id
        );
      }

      const dateOrder = a.leave_date.localeCompare(b.leave_date);

      return (
        (sortOrder === "date-desc" ? -dateOrder : dateOrder) ||
        a.id - b.id
      );
    });

  const dates = month ? calendarDates(month) : [];

  const weeks = Array.from(
    { length: dates.length / 7 },
    (_, index) => dates.slice(index * 7, index * 7 + 7)
  );

  const monthTitle = month
    ? `${Number(month.slice(0, 4))}年${Number(month.slice(5, 7))}月`
    : "読み込み中";

  function changeMonth(value: string) {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(value) ||
      value < "0100-01" ||
      value > "9998-12" ||
      value === month ||
      deletingRef.current
    ) {
      return;
    }

    setLoading(true);
    setError("");
    setActionError("");
    setNotice("");
    setSelectedDate("");
    setRequestedMonth(value);
  }

  function reload() {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  }

  function selectDate(value: string) {
    setSelectedDate(value);

    listRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function clearFilters() {
    setSearchText("");
    setStaffFilter("");
    setTeamFilter("");
    setTypeFilter("");
    setStatusFilter("");
    setSelectedDate("");
  }

  async function handleDelete(row: LeaveRequest) {
    if (deletingRef.current) {
      return;
    }

    const confirmed = confirm(
      `${staffName(row.staff_id)}\n` +
        `${displayDate(row.leave_date)}・${row.leave_type}\n\n` +
        "この希望休を完全に削除しますか？\n" +
        "申請を取り消すだけなら、編集から状態を「取消」に変更してください。"
    );

    if (!confirmed) {
      return;
    }

    deletingRef.current = true;
    setDeletingId(row.id);
    setActionError("");
    setNotice("");

    let deleteAccepted = false;

    try {
      await fetchJson(`/api/leave-requests/${row.id}`, {
        method: "DELETE",
      });

      deleteAccepted = true;

      // 再取得して、削除されたことを確認する
      const updated = readLeaves(
        await fetchJson(`/api/leave-requests?month=${month}`)
      );

      setLeaveRequests(updated);

      if (updated.some((item) => item.id === row.id)) {
        setActionError(
          "データが残っています。削除権限とAPIの処理を確認してください。"
        );
        return;
      }

      setNotice("希望休を削除しました。");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "通信に失敗しました。";

      setActionError(
        deleteAccepted
          ? `削除結果を確認できませんでした。一覧を再読み込みしてください。 ${message}`
          : message
      );
    } finally {
      deletingRef.current = false;
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="希望休管理"
        description="月間カレンダーと一覧で、スタッフの希望休を確認できます。"
        action={
          <Link
            href="/leave-requests/new"
            className="inline-flex whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700"
          >
            ＋ 新規登録
          </Link>
        }
      />

      {/* 月間カレンダー */}
      <section
        aria-labelledby="calendar-title"
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2
            id="calendar-title"
            className="text-xl font-bold text-slate-900"
          >
            {monthTitle}の希望休
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={buttonClass}
              disabled={
                loading ||
                !month ||
                month === "0100-01" ||
                deletingId !== null
              }
              onClick={() => changeMonth(shiftMonth(month, -1))}
            >
              前月
            </button>

            <input
              type="month"
              min="0100-01"
              max="9998-12"
              aria-label="表示月"
              value={month}
              disabled={loading || deletingId !== null}
              onChange={(e) => changeMonth(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />

            <button
              type="button"
              className={buttonClass}
              disabled={
                loading ||
                !month ||
                month === "9998-12" ||
                deletingId !== null
              }
              onClick={() => changeMonth(shiftMonth(month, 1))}
            >
              翌月
            </button>

            <button
              type="button"
              className={buttonClass}
              disabled={loading || deletingId !== null}
              onClick={() => {
                setSelectedDate("");
                changeMonth(getTokyoToday().slice(0, 7));
              }}
            >
              今月
            </button>

            <button
              type="button"
              className={buttonClass}
              disabled={loading || deletingId !== null}
              onClick={reload}
            >
              再読み込み
            </button>
          </div>
        </div>

        <p className="mb-3 text-sm text-slate-600">
          日付を押すと下の一覧をその日に絞り込みます。
          名前を押すと編集画面を開きます。
        </p>

        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          {LEAVE_TYPES.map((type) => (
            <span
              key={type}
              className={`rounded border px-2 py-1 ${leaveClass(type)}`}
            >
              {type}
            </span>
          ))}

          <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-slate-600">
            取消：灰色・取り消し線
          </span>
        </div>

        {loading ? (
          <p
            role="status"
            className="py-10 text-center text-slate-600"
          >
            希望休を読み込み中です…
          </p>
        ) : error ? (
          <div
            role="alert"
            className="rounded-lg bg-red-50 p-4 text-red-800"
          >
            {error}
            <p className="mt-1 text-sm">
              データを取得できていないため、0件とは判定していません。
              「再読み込み」をお試しください。
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">
              検索条件に合う表示月の登録：
              {filteredMonthRequests.length}件
              （うち取消{" "}
              {
                filteredMonthRequests.filter(
                  (row) => row.status === "取消"
                ).length
              }
              件）
            </p>

            <div className="overflow-x-auto">
              <table
                className="w-full min-w-[840px] table-fixed border-collapse"
                aria-label={`${monthTitle}の希望休カレンダー`}
              >
                <thead>
                  <tr>
                    {WEEKDAYS.map((day, index) => (
                      <th
                        key={day}
                        scope="col"
                        className={`border border-slate-200 bg-slate-50 p-2 text-center text-sm ${
                          index === 0
                            ? "text-red-700"
                            : index === 6
                              ? "text-blue-700"
                              : "text-slate-700"
                        }`}
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {weeks.map((week, weekIndex) => (
                    <tr key={weekIndex}>
                      {week.map((date, dayIndex) => {
                        if (!date) {
                          return (
                            <td
                              key={`empty-${dayIndex}`}
                              className="border border-slate-200 bg-slate-50"
                            />
                          );
                        }

                        const entries = requestsByDate.get(date) ?? [];

                        return (
                          <td
                            key={date}
                            className={`h-36 border border-slate-200 p-2 align-top ${
                              selectedDate === date
                                ? "bg-blue-50"
                                : "bg-white"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => selectDate(date)}
                              aria-pressed={selectedDate === date}
                              aria-label={`${displayDate(date)}の一覧、${entries.length}件`}
                              className={`mb-2 flex w-full items-center justify-between rounded px-1 py-1 text-sm focus-visible:outline-2 focus-visible:outline-blue-600 ${
                                date === today
                                  ? "bg-blue-600 font-bold text-white hover:bg-blue-700"
                                  : dayIndex === 0
                                    ? "text-red-700 hover:bg-slate-100"
                                    : dayIndex === 6
                                      ? "text-blue-700 hover:bg-slate-100"
                                      : "text-slate-800 hover:bg-slate-100"
                              }`}
                            >
                              <span>{Number(date.slice(8))}</span>
                              <span className="text-xs">
                                {entries.length > 0
                                  ? `${entries.length}件`
                                  : ""}
                              </span>
                            </button>

                            <div className="space-y-1">
                              {entries.slice(0, 3).map((row) => (
                                <Link
                                  key={row.id}
                                  href={`/leave-requests/${row.id}`}
                                  title={`${staffName(row.staff_id)}・${row.leave_type}・${row.status}`}
                                  className={`block rounded border px-2 py-1 text-xs hover:brightness-95 ${
                                    row.status === "取消"
                                      ? "border-slate-200 bg-slate-100 text-slate-600 line-through"
                                      : leaveClass(row.leave_type)
                                  }`}
                                >
                                  <span className="block truncate font-medium">
                                    {staffMap.get(row.staff_id)?.name ??
                                      `ID:${row.staff_id}`}
                                  </span>
                                  <span className="block truncate">
                                    {row.leave_type}・{row.status}
                                  </span>
                                </Link>
                              ))}

                              {entries.length > 3 && (
                                <button
                                  type="button"
                                  onClick={() => selectDate(date)}
                                  className="w-full py-1 text-left text-xs font-medium text-blue-700 hover:underline"
                                >
                                  ほか{entries.length - 3}件を一覧で見る
                                </button>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* 検索・フィルター付き一覧 */}
      <section
        ref={listRef}
        aria-labelledby="list-title"
        className="scroll-mt-4 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="list-title"
            className="text-xl font-bold text-slate-900"
          >
            {selectedDate
              ? `${displayDate(selectedDate)}の一覧`
              : `${monthTitle}の一覧`}
          </h2>

          {selectedDate && (
            <button
              type="button"
              className={buttonClass}
              onClick={() => setSelectedDate("")}
            >
              日付の選択を解除
            </button>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-600">
            検索・フィルターは上のカレンダーにも反映されます。
            対象は表示中の月です。
          </p>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              検索
            </span>
            <input
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="社員番号・名前・備考で検索"
              className={inputClass}
            />
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label>
              <span className="mb-1 block text-sm font-medium">
                スタッフ
              </span>
              <select
                value={staffFilter}
                onChange={(e) => setStaffFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">すべて</option>
                {staffOptions.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.employee_no} {staff.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">
                チーム
              </span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">すべて</option>
                {teams.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">
                休暇種別
              </span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">すべて</option>
                {types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-medium">
                状態
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={inputClass}
              >
                <option value="">すべて</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-blue-700 hover:underline"
            >
              検索・フィルター・日付選択をクリア
            </button>

            <label>
              <span className="mb-1 block text-sm font-medium">
                並び順
              </span>
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as SortOrder)
                }
                className={inputClass}
              >
                <option value="date-asc">日付が早い順</option>
                <option value="date-desc">日付が遅い順</option>
                <option value="staff">スタッフ順（社員番号）</option>
              </select>
            </label>
          </div>
        </div>

        {actionError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 p-3 text-red-800"
          >
            {actionError}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-lg bg-green-50 p-3 text-green-800"
          >
            {notice}
          </p>
        )}

        {!loading && !error && (
          <p role="status" className="text-sm text-slate-600">
            表示件数：<strong>{filteredRequests.length}</strong>件
            （取消を含む・同じスタッフの複数申請は別々に数えます）
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[850px]">
            <thead className="bg-slate-100">
              <tr>
                {[
                  "スタッフ",
                  "希望日",
                  "チーム",
                  "休暇種別",
                  "状態",
                  "備考",
                  "操作",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="whitespace-nowrap p-4 text-left text-sm"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    読み込み中です…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-red-700"
                  >
                    一覧を取得できませんでした。
                    上のエラー内容を確認してください。
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-slate-500"
                  >
                    表示月・検索条件に一致する希望休はありません。
                  </td>
                </tr>
              ) : (
                filteredRequests.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-t border-slate-200 ${
                      row.status === "取消"
                        ? "bg-slate-50 text-slate-600"
                        : ""
                    }`}
                  >
                    <td className="p-4">
                      {staffName(row.staff_id)}
                    </td>

                    <td className="whitespace-nowrap p-4">
                      {displayDate(row.leave_date)}
                    </td>

                    <td className="p-4">
                      {staffMap.get(row.staff_id)?.team || "－"}
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full border px-2 py-1 text-xs ${leaveClass(
                          row.leave_type
                        )}`}
                      >
                        {row.leave_type}
                      </span>
                    </td>

                    <td className="p-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-xs ${statusClass(
                          row.status
                        )}`}
                      >
                        {row.status}
                      </span>
                    </td>

                    <td className="max-w-xs whitespace-pre-wrap break-words p-4">
                      {row.note || "－"}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center gap-4">
                        <Link
                          href={`/leave-requests/${row.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          編集
                        </Link>

                        <button
                          type="button"
                          disabled={deletingId !== null}
                          onClick={() => void handleDelete(row)}
                          className="font-medium text-red-600 hover:underline disabled:opacity-50"
                        >
                          {deletingId === row.id ? "削除中…" : "削除"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}