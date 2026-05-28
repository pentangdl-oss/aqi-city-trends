import React from "react";

export default function DateRangeSelector({ startDate, endDate, minDate, maxDate, onChange }) {
  return (
    <section className="space-y-2">
      <div className="control-label">时间范围</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          aria-label="开始日期"
          type="date"
          min={minDate}
          max={endDate}
          value={startDate}
          onChange={(event) => onChange(event.target.value, endDate)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-700"
        />
        <input
          aria-label="结束日期"
          type="date"
          min={startDate}
          max={maxDate}
          value={endDate}
          onChange={(event) => onChange(startDate, event.target.value)}
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-cyan-700"
        />
      </div>
    </section>
  );
}
