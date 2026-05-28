import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
const AqiTrendChart = lazy(() => import("./components/AqiTrendChart"));
import CitySelector from "./components/CitySelector";
import DateRangeSelector from "./components/DateRangeSelector";
import MetricSelector from "./components/MetricSelector";
import SummaryCards from "./components/SummaryCards";
import { downloadTextFile, loadAqiCsv, toCsv } from "./utils/loadCsv";
import { metricLabel } from "./utils/aqiLevel";

function periodToDate(period) {
  return period.length === 7 ? `${period}-01` : period;
}

function monthEndDate(period) {
  if (period.length !== 7) return period;
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function previousYearStart(dateText) {
  const date = new Date(`${dateText}T00:00:00`);
  return `${date.getFullYear() - 1}-01-01`;
}

function clampDate(date, minDate, maxDate) {
  if (minDate && date < minDate) return minDate;
  if (maxDate && date > maxDate) return maxDate;
  return date;
}

function defaultDateRange({ minDate, maxDate }) {
  if (!minDate || !maxDate) return { start: "", end: "" };
  const today = formatDate(new Date());
  const end = clampDate(today, minDate, maxDate);
  const start = clampDate(previousYearStart(end), minDate, end);
  return { start, end };
}

export default function App() {
  const [mode, setMode] = useState("monthly");
  const [metric, setMetric] = useState("AQI");
  const [selectedCities, setSelectedCities] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState("loading");
  const [chart, setChart] = useState(null);
  const [rangeTouched, setRangeTouched] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadAqiCsv(mode)
      .then((data) => {
        if (!cancelled) {
          setRows(data);
          setStatus("ready");
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const availableCities = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.city))).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [rows]);

  const availableRange = useMemo(() => {
    const periods = rows.map((row) => row.period).filter(Boolean).sort();
    if (!periods.length) return { minDate: "", maxDate: "" };
    return {
      minDate: periodToDate(periods[0]),
      maxDate: monthEndDate(periods[periods.length - 1])
    };
  }, [rows]);

  useEffect(() => {
    if (!availableCities.length) return;
    setSelectedCities((current) => {
      const stillAvailable = current.filter((city) => availableCities.includes(city));
      return stillAvailable.length ? stillAvailable : availableCities;
    });
  }, [availableCities]);

  useEffect(() => {
    if (!availableRange.minDate || !availableRange.maxDate || rangeTouched) return;
    const nextRange = defaultDateRange(availableRange);
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  }, [availableRange, rangeTouched]);

  function changeMode(nextMode) {
    setMode(nextMode);
    setRangeTouched(false);
    setSelectedCities([]);
    setStartDate("");
    setEndDate("");
  }

  const filteredRows = useMemo(() => {
    return rows
      .filter((row) => selectedCities.includes(row.city))
      .filter((row) => {
        const date = periodToDate(row.period);
        return (!startDate || date >= startDate) && (!endDate || date <= endDate);
      })
      .sort((a, b) => a.period.localeCompare(b.period) || a.city.localeCompare(b.city));
  }, [endDate, rows, selectedCities, startDate]);

  const handleRangeChange = useCallback((start, end) => {
    setRangeTouched(true);
    setStartDate(start);
    setEndDate(end);
  }, []);

  function exportPng() {
    if (!chart) return;
    const url = chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#ffffff"
    });
    const link = document.createElement("a");
    link.href = url;
    link.download = `aqi-${mode}-${metric}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportCsv() {
    downloadTextFile(`aqi-${mode}-${metric}-filtered.csv`, toCsv(filteredRows));
  }

  const subtitle = startDate && endDate
    ? `${availableCities.join("、")}，${startDate} 至 ${endDate}，展示${mode === "monthly" ? "月均" : "日度"} AQI。`
    : `读取${mode === "monthly" ? "月均" : "日度"} AQI 数据中。`;

  return (
    <main className="min-h-screen bg-[#f4f7f9] text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal text-slate-950 sm:text-3xl">
              中国城市 AQI 趋势
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {subtitle}
            </p>
          </div>
          <div className="inline-flex w-fit rounded-md border border-slate-200 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => changeMode("monthly")}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                mode === "monthly" ? "bg-cyan-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              月度趋势
            </button>
            <button
              type="button"
              onClick={() => changeMode("daily")}
              className={`rounded px-4 py-2 text-sm font-semibold ${
                mode === "daily" ? "bg-cyan-700 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              日度趋势
            </button>
          </div>
        </header>

        <section className="panel rounded-lg p-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_0.75fr_auto] lg:items-end">
            <CitySelector cities={availableCities} selectedCities={selectedCities} onChange={setSelectedCities} />
            <DateRangeSelector
              startDate={startDate}
              endDate={endDate}
              minDate={availableRange.minDate}
              maxDate={availableRange.maxDate}
              onChange={handleRangeChange}
            />
            <MetricSelector metric={metric} onChange={setMetric} label="统计指标" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportPng}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                导出 PNG
              </button>
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                下载 CSV
              </button>
            </div>
          </div>
        </section>

        <SummaryCards rows={filteredRows} metric={metric} />

        <section className="panel rounded-lg p-4">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                {metricLabel(metric)} {mode === "monthly" ? "月均" : "日度"}趋势
              </h2>
              <p className="text-sm text-slate-500">每个城市一条线，悬停查看具体数值。</p>
            </div>
            <div className="text-sm text-slate-500">
              {status === "loading" ? "读取数据中" : status === "error" ? "数据读取失败" : `${filteredRows.length} 条记录`}
            </div>
          </div>
          {status === "ready" ? (
            <Suspense fallback={<div className="flex h-[420px] items-center justify-center text-slate-500">正在加载图表...</div>}>
              <AqiTrendChart
                rows={filteredRows}
                cities={selectedCities}
                metric={metric}
                mode={mode}
                onReady={setChart}
              />
            </Suspense>
          ) : (
            <div className="flex h-[420px] items-center justify-center text-slate-500">
              {status === "error" ? "请检查 data 目录下的 CSV 文件。" : "正在加载 CSV 数据..."}
            </div>
          )}
        </section>

        <footer className="pb-5 text-xs leading-6 text-slate-500">
          数据来源优先为 aqistudy.cn 历史空气质量数据页面。该网站说明每日和月度 AQI
          数据依据环保总站每小时数据计算平均得到，可能存在丢数据场景；本页面数据仅用于趋势参考。
        </footer>
      </div>
    </main>
  );
}
