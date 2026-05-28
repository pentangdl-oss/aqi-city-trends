import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const input = process.argv[2];
const output = process.argv[3];

if (!input || !output) {
  console.error("Usage: node scripts/clean-aqi-data.js <input.csv> <output.csv>");
  process.exit(1);
}

const FIELD_ALIASES = {
  city: ["city", "城市"],
  date: ["date", "日期"],
  month: ["month", "月份"],
  AQI: ["AQI", "aqi"],
  "PM2.5": ["PM2.5", "PM25", "pm2.5"],
  PM10: ["PM10", "pm10"],
  SO2: ["SO2", "so2"],
  NO2: ["NO2", "no2"],
  CO: ["CO", "co"],
  O3: ["O3", "O3_8h", "o3"],
  O3_8h: ["O3_8h", "O3", "o3_8h"],
  quality_level: ["quality_level", "质量等级", "质量"]
};

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current);
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

const text = await readFile(input, "utf8");
const [headers, ...records] = parseCsv(text);
const indexByField = new Map();

for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
  const index = headers.findIndex((header) => aliases.includes(header.trim()));
  if (index >= 0) indexByField.set(field, index);
}

const isMonthly = indexByField.has("month") || output.includes("monthly");
const columns = isMonthly
  ? ["city", "month", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"]
  : ["city", "date", "AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h", "quality_level"];

const cleaned = records.map((record) => {
  const row = {};
  for (const column of columns) {
    const index = indexByField.get(column);
    row[column] = index == null ? "" : record[index]?.trim() ?? "";
  }
  return row;
});

const csv = `${[columns.join(","), ...cleaned.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\n")}\n`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, csv, "utf8");

if (output.startsWith("data/")) {
  const publicOutput = path.join("public", output);
  await mkdir(path.dirname(publicOutput), { recursive: true });
  await writeFile(publicOutput, csv, "utf8");
}

console.log(`Wrote ${cleaned.length} rows to ${output}`);
