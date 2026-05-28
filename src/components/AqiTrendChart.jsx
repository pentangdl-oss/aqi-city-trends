import React, { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts";
import { AQI_LINES, metricLabel } from "../utils/aqiLevel";

const CITY_COLORS = {
  "合肥": "#006D77",
  "郑州": "#D55E00",
  "许昌": "#7B2CBF",
  "常州": "#2A9D8F",
  "中山": "#C1121F",
  "长沙": "#1D4ED8",
  "武汉": "#CA8A04",
  "南京": "#DB2777"
};

const FALLBACK_COLORS = [
  "#006D77",
  "#D55E00",
  "#7B2CBF",
  "#2A9D8F",
  "#C1121F",
  "#1D4ED8",
  "#CA8A04",
  "#DB2777",
  "#4D7C0F",
  "#9333EA",
  "#0F766E",
  "#B45309",
  "#475569",
  "#E11D48",
  "#0891B2",
  "#A16207"
];

function cityColor(city, index) {
  return CITY_COLORS[city] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export default function AqiTrendChart({ rows, cities, metric, mode, onReady }) {
  const chartRef = useRef(null);
  const instanceRef = useRef(null);

  const option = useMemo(() => {
    const periods = Array.from(new Set(rows.map((row) => row.period))).sort();
    const series = cities.map((city, index) => {
      const byPeriod = new Map(rows.filter((row) => row.city === city).map((row) => [row.period, row]));
      return {
        name: city,
        type: "line",
        smooth: mode === "monthly",
        symbolSize: mode === "monthly" ? 5 : 3,
        connectNulls: false,
        itemStyle: { color: cityColor(city, index) },
        lineStyle: { width: 2.5 },
        data: periods.map((period) => {
          const value = byPeriod.get(period)?.[metric];
          return Number.isFinite(Number(value)) ? Number(value) : null;
        })
      };
    });

    return {
      backgroundColor: "#ffffff",
      color: cities.map((city, index) => cityColor(city, index)),
      grid: { left: 54, right: 24, top: 58, bottom: 70 },
      legend: { top: 16, itemGap: 18, textStyle: { color: "#334155" } },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value) => (value == null ? "--" : value)
      },
      toolbox: { show: false },
      xAxis: {
        type: "category",
        data: periods,
        boundaryGap: false,
        axisLabel: {
          color: "#64748b",
          hideOverlap: true,
          formatter: (value) => (mode === "daily" ? value.slice(5) : value)
        },
        axisLine: { lineStyle: { color: "#cbd5e1" } }
      },
      yAxis: {
        type: "value",
        name: metricLabel(metric),
        nameTextStyle: { color: "#64748b" },
        axisLabel: { color: "#64748b" },
        splitLine: { lineStyle: { color: "#e2e8f0" } }
      },
      dataZoom: [
        { type: "inside", throttle: 50 },
        { type: "slider", height: 24, bottom: 24, borderColor: "#cbd5e1" }
      ],
      series: metric === "AQI"
        ? series.map((item, index) => ({
            ...item,
            markLine: index === 0
              ? {
                  symbol: "none",
                  label: { formatter: "{b}", color: "#475569" },
                  lineStyle: { type: "dashed" },
                  data: AQI_LINES.map((line) => ({
                    yAxis: line.value,
                    name: `${line.value} ${line.label}`,
                    lineStyle: { color: line.color }
                  }))
                }
              : undefined
          }))
        : series
    };
  }, [cities, metric, mode, rows]);

  useEffect(() => {
    if (!chartRef.current) return;
    instanceRef.current = echarts.init(chartRef.current);
    onReady?.(instanceRef.current);

    const resize = () => instanceRef.current?.resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      instanceRef.current?.dispose();
      instanceRef.current = null;
    };
  }, [onReady]);

  useEffect(() => {
    instanceRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={chartRef} className="h-[420px] w-full" />;
}
