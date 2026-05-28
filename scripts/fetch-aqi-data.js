import { mkdir, writeFile } from "node:fs/promises";

const CITIES = (process.env.CITIES ?? "合肥,郑州,许昌,常州").split(",").map((item) => item.trim()).filter(Boolean);
const START_MONTH = process.env.START_MONTH ?? "202501";
const END_MONTH = process.env.END_MONTH ?? "202601";
const BASE_URL = "https://www.aqistudy.cn/historydata";
const DAILY_COLUMNS = ["city", "date", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];
const MONTHLY_COLUMNS = ["city", "month", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];

function normalizeText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function stripTags(cell) {
  return normalizeText(cell).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function parseTables(html) {
  const tables = [];
  for (const tableMatch of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const rows = [];
    for (const rowMatch of tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = Array.from(rowMatch[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi), (match) => stripTags(match[1]));
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

function toNumber(value) {
  const numeric = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : "";
}

function headerIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.some((alias) => header.toLowerCase().includes(alias.toLowerCase())));
}

function parseAqiTable(html, city, mode) {
  const tables = parseTables(html);
  const output = [];

  for (const table of tables) {
    const headers = table[0];
    const dateIndex = headerIndex(headers, mode === "monthly" ? ["月份", "month", "日期"] : ["日期", "date"]);
    const aqiIndex = headerIndex(headers, ["AQI"]);
    if (dateIndex < 0 || aqiIndex < 0) continue;

    const indexes = {
      pm25: headerIndex(headers, ["PM2.5", "PM25"]),
      pm10: headerIndex(headers, ["PM10"]),
      so2: headerIndex(headers, ["SO2"]),
      no2: headerIndex(headers, ["NO2"]),
      co: headerIndex(headers, ["CO"]),
      o3: headerIndex(headers, ["O3_8h", "O3"]),
      quality: headerIndex(headers, ["质量等级", "质量", "quality"])
    };

    for (const cells of table.slice(1)) {
      const rawPeriod = cells[dateIndex];
      if (!rawPeriod) continue;
      const period = mode === "monthly"
        ? rawPeriod.replace(/[年月]/g, "-").replace(/日/g, "").slice(0, 7)
        : rawPeriod.replace(/[年月]/g, "-").replace(/日/g, "");

      output.push({
        city,
        [mode === "monthly" ? "month" : "date"]: period,
        AQI: toNumber(cells[aqiIndex]),
        "PM2.5": indexes.pm25 >= 0 ? toNumber(cells[indexes.pm25]) : "",
        PM10: indexes.pm10 >= 0 ? toNumber(cells[indexes.pm10]) : "",
        SO2: indexes.so2 >= 0 ? toNumber(cells[indexes.so2]) : "",
        NO2: indexes.no2 >= 0 ? toNumber(cells[indexes.no2]) : "",
        CO: indexes.co >= 0 ? toNumber(cells[indexes.co]) : "",
        O3: indexes.o3 >= 0 ? toNumber(cells[indexes.o3]) : "",
        O3_8h: indexes.o3 >= 0 ? toNumber(cells[indexes.o3]) : "",
        quality_level: indexes.quality >= 0 ? cells[indexes.quality] : ""
      });
    }
  }

  return output;
}

function monthRange(start, end) {
  const months = [];
  const cursor = new Date(`${start.slice(0, 4)}-${start.slice(4, 6)}-01T00:00:00Z`);
  const final = new Date(`${end.slice(0, 4)}-${end.slice(4, 6)}-01T00:00:00Z`);
  while (cursor <= final) {
    months.push(`${cursor.getUTCFullYear()}${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows, columns) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n");
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; AQI trend data script)",
      "Referer": `${BASE_URL}/`
    }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}

const monthlyRows = [];
const dailyRows = [];

for (const city of CITIES) {
  const monthUrl = `${BASE_URL}/monthdata.php?city=${encodeURIComponent(city)}`;
  console.log(`Fetching monthly: ${city}`);
  const monthHtml = await fetchHtml(monthUrl);
  monthlyRows.push(...parseAqiTable(monthHtml, city, "monthly"));

  for (const month of monthRange(START_MONTH, END_MONTH)) {
    const dayUrl = `${BASE_URL}/daydata.php?city=${encodeURIComponent(city)}&month=${month}`;
    console.log(`Fetching daily: ${city} ${month}`);
    const dayHtml = await fetchHtml(dayUrl);
    dailyRows.push(...parseAqiTable(dayHtml, city, "daily"));
  }
}

if (!monthlyRows.length || !dailyRows.length) {
  console.error(
    `Parsed ${monthlyRows.length} monthly rows and ${dailyRows.length} daily rows. ` +
    "The source pages may be blocked or their table structure may have changed; existing CSV files were not overwritten."
  );
  process.exit(1);
}

await mkdir("public/data", { recursive: true });

const monthlyCsv = `${toCsv(monthlyRows, MONTHLY_COLUMNS)}\n`;
const dailyCsv = `${toCsv(dailyRows, DAILY_COLUMNS)}\n`;
await writeFile("public/data/aqi_monthly.csv", monthlyCsv, "utf8");
await writeFile("public/data/aqi_daily.csv", dailyCsv, "utf8");
console.log(`Wrote ${monthlyRows.length} monthly rows and ${dailyRows.length} daily rows.`);
