import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const input = process.argv[2] ?? "data/aqi_monthly_new.xlsx";
const output = process.argv[3] ?? "public/data/aqi_monthly.csv";
const COLUMNS = ["city", "month", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];

function unzipText(filePath, entry) {
  return execFileSync("unzip", ["-p", filePath, entry], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function decodeXml(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
}

function parseSharedStrings(xml) {
  return Array.from(xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g), (match) => {
    const textParts = Array.from(match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g), (part) => decodeXml(part[1]));
    return textParts.join("");
  });
}

function columnIndex(cellRef) {
  const letters = cellRef.replace(/\d+/g, "");
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }
  return index - 1;
}

function excelSerialToMonth(serial) {
  const days = Number(serial);
  if (!Number.isFinite(days)) return "";
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + days * 86400000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseCell(cellXml, sharedStrings) {
  const ref = cellXml.match(/\sr="([^"]+)"/)?.[1];
  const type = cellXml.match(/\st="([^"]+)"/)?.[1];
  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
  const inline = cellXml.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];

  if (!ref) return null;
  if (type === "s") return { ref, value: sharedStrings[Number(value)] ?? "" };
  if (type === "inlineStr") return { ref, value: decodeXml(inline ?? "") };
  return { ref, value: decodeXml(value) };
}

function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c\b[^>]*>[\s\S]*?<\/c>/g)) {
      const cell = parseCell(cellMatch[0], sharedStrings);
      if (cell) row[columnIndex(cell.ref)] = cell.value;
    }
    rows.push(row.map((value) => value ?? ""));
  }
  return rows;
}

function normalizeHeader(header) {
  return String(header).replace(/\s+/g, "").toLowerCase();
}

function findColumn(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function toNumber(value) {
  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(number) ? number : "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toCsv(rows) {
  return [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((column) => csvEscape(row[column])).join(","))
  ].join("\n");
}

const sharedStrings = parseSharedStrings(unzipText(input, "xl/sharedStrings.xml"));
const sheetXml = unzipText(input, "xl/worksheets/sheet1.xml");
const [headers, ...records] = parseSheetRows(sheetXml, sharedStrings);

const indexes = {
  city: findColumn(headers, ["城市", "city"]),
  month: findColumn(headers, ["月份", "month", "日期", "date"]),
  AQI: findColumn(headers, ["aqi"]),
  pm25: findColumn(headers, ["pm2.5", "pm25"]),
  pm10: findColumn(headers, ["pm10"]),
  so2: findColumn(headers, ["so2"]),
  no2: findColumn(headers, ["no2"]),
  co: findColumn(headers, ["co"]),
  o3: findColumn(headers, ["o3", "o3_8h"]),
  quality: findColumn(headers, ["质量等级", "quality_level", "quality"])
};

const missing = Object.entries(indexes)
  .filter(([key, index]) => key !== "quality" && index < 0)
  .map(([key]) => key);

if (missing.length) {
  throw new Error(`Missing required columns in ${input}: ${missing.join(", ")}`);
}

const rows = records
  .map((record) => {
    const rawMonth = record[indexes.month];
    const month = /^\d+(\.\d+)?$/.test(String(rawMonth)) ? excelSerialToMonth(rawMonth) : String(rawMonth).slice(0, 7);
    const o3 = toNumber(record[indexes.o3]);
    return {
      city: record[indexes.city],
      month,
      AQI: toNumber(record[indexes.AQI]),
      "PM2.5": toNumber(record[indexes.pm25]),
      PM10: toNumber(record[indexes.pm10]),
      SO2: toNumber(record[indexes.so2]),
      NO2: toNumber(record[indexes.no2]),
      CO: toNumber(record[indexes.co]),
      O3: o3,
      O3_8h: o3,
      quality_level: indexes.quality >= 0 ? record[indexes.quality] : ""
    };
  })
  .filter((row) => row.city && row.month && row.AQI !== "")
  .sort((a, b) => a.month.localeCompare(b.month) || a.city.localeCompare(b.city));

if (!rows.length) {
  throw new Error(`No monthly AQI rows parsed from ${input}`);
}

const csv = `${toCsv(rows)}\n`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, csv, "utf8");

const cities = new Set(rows.map((row) => row.city));
console.log(`Wrote ${rows.length} monthly rows for ${cities.size} cities to ${output}`);
console.log(`Range: ${rows[0].month} to ${rows[rows.length - 1].month}`);
