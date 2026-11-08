"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/common/PageHeader";
import PrimaryButton from "@/components/ui/PrimaryButton";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";

type EventForm = {
  event_name: string;
  event_date: string;
  time_period: string;
  recurrence_type: string;
  recurrence_rule: string;
  event_type: string;
  note: string;
};

export default function EditEventPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<EventForm>({
    event_name: "",
    event_date: "",
    time_period: "",
    recurrence_type: "なし",
    recurrence_rule: "",
    event_type: "",
    note: "",
  });

  useEffect(() => {
    const fetchEvent = async () => {
      const response = await fetch(`/api/events/${id}`);
      const data = await response.json();

      if (!response.ok) {
        alert(data.error ?? "予定情報の取得に失敗しました");
        return;
      }

      setForm({
        event_name: data.event_name ?? "",
        event_date: data.event_date ?? "",
        time_period: data.time_period ?? "",
        recurrence_type: data.recurrence_type ?? "なし",
        recurrence_rule: data.recurrence_rule ?? "",
        event_type: data.event_type ?? "",
        note: data.note ?? "",
      });

      setLoading(false);
    };

    fetchEvent();
  }, [id]);

  const handleUpdate = async () => {
    if (!form.event_name) {
      alert("予定名を入力してください");
      return;
    }

    if (!form.event_date) {
      alert("開催日を入力してください");
      return;
    }

    const response = await fetch(`/api/events/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(form),
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.error ?? "更新に失敗しました");
      return;
    }

    alert("予定を更新しました！");

    router.push("/meetings");
    router.refresh();
  };

  if (loading) {
    return <p>読み込み中...</p>;
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="予定編集"
        description="病棟の予定・イベントを編集します。"
      />

      <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <label className="mb-2 block font-medium">
            予定名
          </label>

          <Input
            value={form.event_name}
            onChange={(e) =>
              setForm({
                ...form,
                event_name: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            開催日
          </label>

          <Input
            type="date"
            value={form.event_date}
            onChange={(e) =>
              setForm({
                ...form,
                event_date: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            時間帯
          </label>

          <Select
            value={form.time_period}
            onChange={(e) =>
              setForm({
                ...form,
                time_period: e.target.value,
              })
            }
          >
            <option value="">選択してください</option>
            <option value="AM">AM</option>
            <option value="PM">PM</option>
            <option value="終日">終日</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            イベント種別
          </label>

          <Select
            value={form.event_type}
            onChange={(e) =>
              setForm({
                ...form,
                event_type: e.target.value,
              })
            }
          >
            <option value="">選択してください</option>
            <option value="入浴日">入浴日</option>
            <option value="研修">研修</option>
            <option value="健診">健診</option>
            <option value="レクリエーション">
              レクリエーション
            </option>
            <option value="その他">その他</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            繰り返し
          </label>

          <Select
            value={form.recurrence_type}
            onChange={(e) =>
              setForm({
                ...form,
                recurrence_type: e.target.value,
              })
            }
          >
            <option value="なし">なし</option>
            <option value="毎週">毎週</option>
            <option value="毎月">毎月</option>
          </Select>
        </div>

        <div>
          <label className="mb-2 block font-medium">
            繰り返し条件
          </label>

          <Input
            value={form.recurrence_rule}
            onChange={(e) =>
              setForm({
                ...form,
                recurrence_rule: e.target.value,
              })
            }
          />
        </div>

        <div>
          <label className="mb-2 block font-medium">
            備考
          </label>

          <Input
            value={form.note}
            onChange={(e) =>
              setForm({
                ...form,
                note: e.target.value,
              })
            }
          />
        </div>

        <PrimaryButton onClick={handleUpdate}>
          更新する
        </PrimaryButton>
      </div>
    </div>
  );
}