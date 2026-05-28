import { mkdir, writeFile } from "node:fs/promises";

const API_KEY = process.env.IQAIR_API_KEY;
const OUTPUT = process.env.OUTPUT ?? "data/iqair_current.csv";
const CITIES = [
  { city: "Hefei", city_zh: "合肥", state: "Anhui", country: "China" },
  { city: "Zhengzhou", city_zh: "郑州", state: "Henan", country: "China" },
  { city: "Xuchang", city_zh: "许昌", state: "Henan", country: "China" },
  { city: "Changzhou", city_zh: "常州", state: "Jiangsu", country: "China" }
];
const COLUMNS = [
  "city",
  "date",
  "AQI",
  "AQI_CN",
  "main_pollutant",
  "temperature",
  "humidity",
  "pressure",
  "wind_speed",
  "wind_direction",
  "source"
];

if (!API_KEY) {
  console.error("Missing IQAIR_API_KEY. Create an IQAir API key, then run:");
  console.error("IQAIR_API_KEY=your_key npm run fetch:iqair");
  process.exit(1);
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

function apiUrl(city) {
  const params = new URLSearchParams({
    city: city.city,
    state: city.state,
    country: city.country,
    key: API_KEY
  });
  return `https://api.airvisual.com/v2/city?${params.toString()}`;
}

async function fetchCity(city) {
  const response = await fetch(apiUrl(city));
  const json = await response.json();

  if (!response.ok || json.status !== "success") {
    const message = json.data?.message ?? response.statusText;
    throw new Error(`${city.city_zh}: ${message}`);
  }

  const current = json.data.current;
  const pollution = current.pollution ?? {};
  const weather = current.weather ?? {};
  const date = pollution.ts ? pollution.ts.slice(0, 10) : new Date().toISOString().slice(0, 10);

  return {
    city: city.city_zh,
    date,
    AQI: pollution.aqius ?? "",
    AQI_CN: pollution.aqicn ?? "",
    main_pollutant: pollution.mainus ?? "",
    temperature: weather.tp ?? "",
    humidity: weather.hu ?? "",
    pressure: weather.pr ?? "",
    wind_speed: weather.ws ?? "",
    wind_direction: weather.wd ?? "",
    source: "IQAir AirVisual API current city endpoint"
  };
}

const rows = [];
for (const city of CITIES) {
  console.log(`Fetching IQAir current data: ${city.city_zh}`);
  rows.push(await fetchCity(city));
}

const csv = `${toCsv(rows)}\n`;
await mkdir("data", { recursive: true });
await mkdir("public/data", { recursive: true });
await writeFile(OUTPUT, csv, "utf8");

if (OUTPUT.startsWith("data/")) {
  await writeFile(`public/${OUTPUT}`, csv, "utf8");
}

console.log(`Wrote ${rows.length} rows to ${OUTPUT}`);
