import Papa from "papaparse";

const NUMERIC_FIELDS = ["AQI", "PM2.5", "PM10", "SO2", "NO2", "CO", "O3", "O3_8h"];

function normalizeRow(row, mode) {
  const normalized = { ...row };
  normalized.period = mode === "monthly" ? row.month : row.date;

  for (const field of NUMERIC_FIELDS) {
    if (field in normalized && normalized[field] !== "") {
      normalized[field] = Number(normalized[field]);
    }
  }

  if (!normalized.O3 && normalized.O3_8h) {
    normalized.O3 = normalized.O3_8h;
  }

  return normalized;
}

export async function loadAqiCsv(mode) {
  const path = mode === "monthly" ? "/data/aqi_monthly.csv" : "/data/aqi_daily.csv";
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`无法读取 ${path}`);
  }

  const text = await response.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0].message);
  }

  return parsed.data.map((row) => normalizeRow(row, mode));
}

export function toCsv(rows) {
  return Papa.unparse(rows);
}

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
