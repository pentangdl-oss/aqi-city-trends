export const AQI_LINES = [
  { value: 50, label: "优", color: "#2f9e44" },
  { value: 100, label: "良", color: "#e0a800" },
  { value: 150, label: "轻度污染", color: "#f08c00" },
  { value: 200, label: "中度污染", color: "#e03131" },
  { value: 300, label: "重度污染", color: "#862e9c" }
];

export function getAqiLevel(aqi) {
  const value = Number(aqi);
  if (!Number.isFinite(value)) return "未知";
  if (value <= 50) return "优";
  if (value <= 100) return "良";
  if (value <= 150) return "轻度污染";
  if (value <= 200) return "中度污染";
  if (value <= 300) return "重度污染";
  return "严重污染";
}

export function metricLabel(metric) {
  const labels = {
    AQI: "AQI",
    "PM2.5": "PM2.5",
    PM10: "PM10",
    O3: "O3 / O3_8h",
    NO2: "NO2",
    SO2: "SO2",
    CO: "CO"
  };
  return labels[metric] ?? metric;
}
