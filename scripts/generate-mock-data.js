import { mkdir, writeFile } from "node:fs/promises";

const CITIES = ["合肥", "郑州", "许昌", "常州"];
const CITY_BASE = {
  "合肥": 64,
  "郑州": 78,
  "许昌": 74,
  "常州": 58
};
const START = new Date("2025-01-01T00:00:00Z");
const END = new Date("2026-01-31T00:00:00Z");
const COLUMNS_DAILY = ["city", "date", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];
const COLUMNS_MONTHLY = ["city", "month", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function qualityLevel(aqi) {
  if (aqi <= 50) return "优";
  if (aqi <= 100) return "良";
  if (aqi <= 150) return "轻度污染";
  if (aqi <= 200) return "中度污染";
  if (aqi <= 300) return "重度污染";
  return "严重污染";
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function dailyRecord(city, date, index) {
  const month = date.getUTCMonth() + 1;
  const winter = month <= 2 || month >= 11 ? 18 : 0;
  const ozoneSeason = month >= 5 && month <= 9 ? 22 : 0;
  const weekly = Math.sin(index / 5) * 8;
  const seasonal = Math.cos((month - 1) / 12 * Math.PI * 2) * 12;
  const cityOffset = CITIES.indexOf(city) * 2.5;
  const aqi = Math.max(25, round(CITY_BASE[city] + winter + seasonal + weekly + cityOffset));
  const pm25 = round(aqi * 0.46 + winter * 0.35 + Math.sin(index / 7) * 2);
  const pm10 = round(aqi * 0.72 + winter * 0.4 + Math.cos(index / 6) * 3);
  const so2 = round(6 + winter * 0.08 + CITIES.indexOf(city) * 0.7 + Math.sin(index / 9), 1);
  const no2 = round(24 + winter * 0.25 + CITIES.indexOf(city) * 1.3 + Math.cos(index / 8) * 2, 1);
  const co = round(0.6 + winter * 0.01 + CITIES.indexOf(city) * 0.03 + Math.sin(index / 10) * 0.04, 2);
  const o3 = round(68 + ozoneSeason + Math.sin(index / 13) * 12 - winter * 0.5);
  const o3_8h = round(o3 * 0.92);

  return {
    city,
    date: formatDate(date),
    AQI: aqi,
    "PM2.5": pm25,
    PM10: pm10,
    SO2: so2,
    NO2: no2,
    CO: co,
    O3: o3,
    O3_8h: o3_8h,
    quality_level: qualityLevel(aqi)
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows, columns) {
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))
  ].join("\n");
}

function average(values, digits = 0) {
  return round(values.reduce((sum, value) => sum + Number(value), 0) / values.length, digits);
}

function buildMonthlyRows(dailyRows) {
  const groups = new Map();
  for (const row of dailyRows) {
    const key = `${row.city}|${row.date.slice(0, 7)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  return Array.from(groups.entries()).map(([key, rows]) => {
    const [city, month] = key.split("|");
    const aqi = average(rows.map((row) => row.AQI));
    return {
      city,
      month,
      AQI: aqi,
      "PM2.5": average(rows.map((row) => row["PM2.5"])),
      PM10: average(rows.map((row) => row.PM10)),
      SO2: average(rows.map((row) => row.SO2), 1),
      NO2: average(rows.map((row) => row.NO2), 1),
      CO: average(rows.map((row) => row.CO), 2),
      O3: average(rows.map((row) => row.O3)),
      O3_8h: average(rows.map((row) => row.O3_8h)),
      quality_level: qualityLevel(aqi)
    };
  }).sort((a, b) => a.month.localeCompare(b.month) || a.city.localeCompare(b.city));
}

const dailyRows = [];
let index = 0;
for (const city of CITIES) {
  for (let cursor = new Date(START); cursor <= END; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    dailyRows.push(dailyRecord(city, cursor, index));
    index += 1;
  }
}

const monthlyRows = buildMonthlyRows(dailyRows);
const dailyCsv = `${toCsv(dailyRows, COLUMNS_DAILY)}\n`;
const monthlyCsv = `${toCsv(monthlyRows, COLUMNS_MONTHLY)}\n`;

await mkdir("data", { recursive: true });
await mkdir("public/data", { recursive: true });
await writeFile("public/data/aqi_daily.csv", dailyCsv, "utf8");
await writeFile("public/data/aqi_monthly.csv", monthlyCsv, "utf8");

console.log(`Wrote ${dailyRows.length} daily rows and ${monthlyRows.length} monthly rows.`);
