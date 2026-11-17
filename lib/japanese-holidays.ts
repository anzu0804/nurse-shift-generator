// Cabinet Office dates include substitute and citizens' holidays.
// https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html
const published: Record<string, string> = {
  "2026": "01-01 01-12 02-11 02-23 03-20 04-29 05-03 05-04 05-05 05-06 07-20 08-11 09-21 09-22 09-23 10-12 11-03 11-23",
  "2027": "01-01 01-11 02-11 02-23 03-21 03-22 04-29 05-03 05-04 05-05 07-19 08-11 09-20 09-23 10-11 11-03 11-23",
};

export class HolidayCalendarError extends Error {}

export async function readJapaneseHolidays(year: string): Promise<Set<string>> {
  if (published[year]) return new Set(published[year].split(" ").map((day) => year + "-" + day));

  // The Cabinet Office publishes future dates annually. Do not estimate unpublished dates.
  try {
    const response = await fetch("https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv", {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Holiday calendar unavailable");
    const dates = new Set<string>();
    for (const line of (await response.text()).split(/\r?\n/)) {
      const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2}),/.exec(line);
      if (match?.[1] === year) dates.add(year + "-" + match[2].padStart(2, "0") + "-" + match[3].padStart(2, "0"));
    }
    if (dates.size > 0) return dates;
  } catch {
    throw new HolidayCalendarError(year + "年の祝日データを取得できませんでした。");
  }
  throw new HolidayCalendarError(year + "年の祝日データが公開されていません。");
}
