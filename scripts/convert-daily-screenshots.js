import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const inputDir = process.argv[2] ?? "data/daily capture";
const output = process.argv[3] ?? "data/aqi_daily_new.csv";
const defaultOutput = path.resolve("data/aqi_daily_new.csv");
const COLUMNS = ["city", "date", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];
const MANUAL_CORRECTIONS = {
  "许昌|2025-01-02|SO2": 11,
  "许昌|2025-02-11|SO2": 7,
  "许昌|2025-02-21|NO2": 22,
  "许昌|2025-02-22|NO2": 24,
  "许昌|2025-02-23|SO2": 6,
  "许昌|2025-02-23|NO2": 29,
  "许昌|2025-02-24|NO2": 27,
  "许昌|2025-03-31|NO2": 17,
  "许昌|2025-06-13|SO2": 3,
  "许昌|2025-06-14|SO2": 4,
  "许昌|2025-06-15|SO2": 6,
  "许昌|2025-06-17|SO2": 5,
  "许昌|2025-06-18|SO2": 3,
  "许昌|2025-06-21|SO2": 3,
  "许昌|2025-06-22|SO2": 2,
  "许昌|2025-06-25|SO2": 4,
  "许昌|2025-06-26|SO2": 2,
  "许昌|2025-08-16|SO2": 3,
  "许昌|2025-08-24|SO2": 4,
  "许昌|2025-10-10|SO2": 2,
  "许昌|2025-10-14|SO2": 4,
  "许昌|2025-10-17|SO2": 3,
  "许昌|2025-10-18|SO2": 4,
  "许昌|2025-10-21|SO2": 6,
  "许昌|2025-10-26|SO2": 5,
  "常州|2026-05-23|PM2.5": 62
};
function runOcr(imagePath) {
  const outputText = execFileSync("swift", ["scripts/ocr-image.swift", imagePath], {
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024
  });
  return outputText
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function cityAndMonth(items, fallbackName) {
  const title = items
    .map((item) => item.text)
    .find((text) => /\d{4}年\d{2}月.+空气质量指数日历史数据/.test(text));

  if (!title) {
    throw new Error(`Could not identify title in ${fallbackName}`);
  }

  const match = title.match(/(\d{4})年(\d{2})月(.+?)空气质量指数日历史数据/);
  if (!match) {
    throw new Error(`Could not parse title "${title}" in ${fallbackName}`);
  }

  return {
    monthPrefix: `${match[1]}-${match[2]}`,
    city: match[3].trim()
  };
}

function normalizeQuality(text) {
  return String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/优.*$/, "优")
    .replace(/良.*$/, "良")
    .replace(/轻度污染.*$/, "轻度污染")
    .replace(/中度污染.*$/, "中度污染")
    .replace(/重度污染.*$/, "重度污染")
    .replace(/严重污染.*$/, "严重污染");
}

function qualityFromAqi(aqi) {
  const value = Number(aqi);
  if (!Number.isFinite(value)) return "";
  if (value <= 50) return "优";
  if (value <= 100) return "良";
  if (value <= 150) return "轻度污染";
  if (value <= 200) return "中度污染";
  if (value <= 300) return "重度污染";
  return "严重污染";
}

function numeric(text) {
  const normalized = String(text ?? "")
    .replace(/[oO]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[^\d.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : "";
}

function numericCell(item, options = {}) {
  if (!item) return "";
  const value = numeric(item.text);
  if (options.preferNonZero && value === 0 && Array.isArray(item.candidates)) {
    for (const candidate of item.candidates) {
      const candidateValue = numeric(candidate);
      if (Number.isFinite(candidateValue) && candidateValue > 0) return candidateValue;
    }
  }
  return value;
}

function nearestCell(items, y, x, options = {}) {
  const maxDy = options.maxDy ?? 26;
  const maxDx = options.maxDx ?? 80;
  const candidates = items
    .filter((item) => Math.abs((item.y + item.h / 2) - y) <= maxDy)
    .filter((item) => Math.abs((item.x + item.w / 2) - x) <= maxDx)
    .sort((a, b) => {
      const ad = Math.abs((a.y + a.h / 2) - y) + Math.abs((a.x + a.w / 2) - x) / 3;
      const bd = Math.abs((b.y + b.h / 2) - y) + Math.abs((b.x + b.w / 2) - x) / 3;
      return ad - bd;
    });
  return candidates[0] ?? null;
}

function normalizeHeader(text) {
  return String(text ?? "")
    .replace(/\s+/g, "")
    .replace(/[oO]/g, "0")
    .toUpperCase();
}

function headerColumns(items, imageName) {
  const headers = {};
  const candidates = items.filter((item) => item.y >= 150 && item.y <= 260);

  for (const item of candidates) {
    const label = normalizeHeader(item.text);
    const center = item.x + item.w / 2;
    if (label === "AQI") headers.AQI = center;
    if (label === "质量等级") headers.quality_level = center;
    if (label === "PM2.5" || label === "PM25") headers["PM2.5"] = center;
    if (label === "PM10") headers.PM10 = center;
    if (label === "NO2" || label === "N02") headers.NO2 = center;
    if (label === "SO2" || label === "S02") headers.SO2 = center;
    if (label === "CO" || label === "C0") headers.CO = center;
    if (label === "O3_8H" || label === "03_8H" || (label.includes("3") && label.includes("8H"))) headers.O3_8h = center;
  }

  if (headers.PM10 != null && headers.O3_8h != null) {
    const pollutantKeys = ["CO", "NO2", "SO2"];
    const slots = [1, 2, 3].map((step) => headers.PM10 + ((headers.O3_8h - headers.PM10) * step) / 4);
    const assignedSlots = new Set();

    for (const key of pollutantKeys) {
      if (headers[key] == null) continue;
      const nearestIndex = slots
        .map((slot, index) => ({ index, distance: Math.abs(slot - headers[key]) }))
        .sort((a, b) => a.distance - b.distance)[0]?.index;
      if (nearestIndex != null) assignedSlots.add(nearestIndex);
    }

    for (const key of pollutantKeys) {
      if (headers[key] != null) continue;
      const openIndex = slots.findIndex((_, index) => !assignedSlots.has(index));
      if (openIndex >= 0) {
        headers[key] = slots[openIndex];
        assignedSlots.add(openIndex);
      }
    }
  }

  const missing = ["AQI", "quality_level", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3_8h"]
    .filter((column) => headers[column] == null);

  if (missing.length) {
    throw new Error(`Missing header columns in ${imageName}: ${missing.join(", ")}`);
  }

  return headers;
}

function parseImage(imagePath) {
  const items = runOcr(imagePath);
  const { city, monthPrefix } = cityAndMonth(items, path.basename(imagePath));
  const columns = headerColumns(items, path.basename(imagePath));
  const dateItems = items
    .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.text))
    .filter((item) => item.text.startsWith(monthPrefix))
    .sort((a, b) => a.text.localeCompare(b.text));

  if (!dateItems.length) {
    throw new Error(`No date rows found in ${path.basename(imagePath)}`);
  }

  return dateItems.map((dateItem) => {
    const y = dateItem.y + dateItem.h / 2;
    const aqi = numericCell(nearestCell(items, y, columns.AQI));
    const pm25 = numericCell(nearestCell(items, y, columns["PM2.5"]));
    const pm10 = numericCell(nearestCell(items, y, columns.PM10));
    const so2 = numericCell(nearestCell(items, y, columns.SO2), { preferNonZero: true });
    const no2 = numericCell(nearestCell(items, y, columns.NO2), { preferNonZero: true });
    const co = numericCell(nearestCell(items, y, columns.CO));
    const o3 = numericCell(nearestCell(items, y, columns.O3_8h));
    const qualityItem = nearestCell(items, y, columns.quality_level, { maxDx: 105, maxDy: 28 });
    const quality = normalizeQuality(qualityItem?.text) || qualityFromAqi(aqi);

    return {
      city,
      date: dateItem.text,
      AQI: aqi,
      "PM2.5": pm25,
      PM10: pm10,
      SO2: so2,
      NO2: no2,
      CO: co,
      O3: o3,
      O3_8h: o3,
      quality_level: quality
    };
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

async function readExistingRows(filePath) {
  try {
    const content = await readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });
      return row;
    }).filter((row) => row.city && row.date);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function toCsv(rows) {
  return [
    COLUMNS.join(","),
    ...rows.map((row) => COLUMNS.map((column) => csvEscape(row[column])).join(","))
  ].join("\n");
}

const existingRows = await readExistingRows(output);
const files = (await readdir(inputDir))
  .filter((file) => /\.(png|jpe?g)$/i.test(file))
  .sort((a, b) => a.localeCompare(b, "zh-CN", { numeric: true }));

if (!files.length && !existingRows.length) {
  throw new Error(`No screenshots found in ${inputDir}`);
}

const parsedRows = [];
for (const file of files) {
  const imagePath = path.join(inputDir, file);
  const parsed = parseImage(imagePath);
  parsedRows.push(...parsed);
  const first = parsed[0];
  console.log(`${file}: ${first.city} ${first.date.slice(0, 7)} (${parsed.length} rows)`);
}

const deduped = Array.from(
  new Map([...existingRows, ...parsedRows].map((row) => [`${row.city}|${row.date}`, row])).values()
).sort((a, b) => a.date.localeCompare(b.date) || a.city.localeCompare(b.city));

for (const row of deduped) {
  for (const column of COLUMNS) {
    const key = `${row.city}|${row.date}|${column}`;
    if (key in MANUAL_CORRECTIONS) {
      row[column] = MANUAL_CORRECTIONS[key];
    }
  }
}

const emptyCells = deduped.flatMap((row) =>
  COLUMNS.filter((column) => row[column] === "" || row[column] == null).map((column) => `${row.city} ${row.date} ${column}`)
);

if (emptyCells.length) {
  console.warn(`Warning: ${emptyCells.length} empty parsed cells. First examples: ${emptyCells.slice(0, 8).join("; ")}`);
}

const csv = `${toCsv(deduped)}\n`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, csv, "utf8");

if (path.resolve(output) === defaultOutput) {
  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/aqi_daily.csv", csv, "utf8");
}

console.log(`Wrote ${deduped.length} rows to ${output}`);
if (existingRows.length || parsedRows.length) {
  console.log(`Merged ${existingRows.length} existing rows with ${parsedRows.length} newly parsed rows by city + date`);
}
