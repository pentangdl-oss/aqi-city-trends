import React from "react";
import { metricLabel } from "../utils/aqiLevel";

const METRICS = ["AQI", "PM2.5", "PM10", "O3", "NO2", "SO2", "CO"];

export default function MetricSelector({ metric, onChange, label = "指标" }) {
  return (
    <section className="space-y-2">
      <div className="control-label">{label}</div>
      <select
        value={metric}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-cyan-700"
      >
        {METRICS.map((item) => (
          <option key={item} value={item}>
            {metricLabel(item)}
          </option>
        ))}
      </select>
    </section>
  );
}
