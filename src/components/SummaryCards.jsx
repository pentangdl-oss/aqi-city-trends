import React from "react";
import { getAqiLevel, metricLabel } from "../utils/aqiLevel";

export default function SummaryCards({ rows, metric }) {
  const values = rows.map((row) => Number(row[metric])).filter(Number.isFinite);
  const average = values.length
    ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10
    : null;
  const max = values.length ? Math.max(...values) : null;
  const latestRows = [...rows].sort((a, b) => a.period.localeCompare(b.period)).slice(-4);

  return (
    <section className="grid gap-3 md:grid-cols-3">
      <div className="panel rounded-lg p-4">
        <div className="text-sm text-slate-500">筛选记录</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">{rows.length}</div>
      </div>
      <div className="panel rounded-lg p-4">
        <div className="text-sm text-slate-500">平均 {metricLabel(metric)}</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">{average ?? "--"}</div>
      </div>
      <div className="panel rounded-lg p-4">
        <div className="text-sm text-slate-500">最高 {metricLabel(metric)}</div>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-2xl font-semibold text-slate-900">{max ?? "--"}</span>
          {metric === "AQI" && max ? (
            <span className="pb-1 text-sm text-slate-500">{getAqiLevel(max)}</span>
          ) : null}
        </div>
      </div>
      <div className="panel rounded-lg p-4 md:col-span-3">
        <div className="text-sm text-slate-500">最近数据</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {latestRows.map((row) => (
            <div key={`${row.city}-${row.period}`} className="rounded-md bg-slate-50 px-3 py-2">
              <div className="text-xs text-slate-500">{row.city} · {row.period}</div>
              <div className="mt-1 font-semibold text-slate-800">{row[metric] ?? "--"}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
