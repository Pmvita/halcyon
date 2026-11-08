"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type CandlestickData,
  type Time,
  type SeriesMarker,
} from "lightweight-charts";
import type { Bar, ChartMarker, ChartSeries } from "@halcyon/domain";

const RANGES = ["1D", "5D", "1M", "3M", "1Y"] as const;

type Props = {
  symbol: string;
  initial?: ChartSeries | null;
  bars?: Bar[];
};

function toDayTime(iso: string): Time {
  return iso.slice(0, 10) as Time;
}

function toUnixTime(iso: string): Time {
  return Math.floor(new Date(iso).getTime() / 1000) as Time;
}

function mapBars(bars: Bar[], intraday: boolean): CandlestickData<Time>[] {
  const stamp = intraday ? toUnixTime : toDayTime;
  const out: CandlestickData<Time>[] = [];
  let last: string | null = null;
  for (const bar of bars) {
    const time = stamp(bar.t);
    const key = String(time);
    if (key === last) continue;
    last = key;
    out.push({ time, open: bar.o, high: bar.h, low: bar.l, close: bar.c });
  }
  return out;
}

function mapMarkers(markers: ChartMarker[], intraday: boolean): SeriesMarker<Time>[] {
  const stamp = intraday ? toUnixTime : toDayTime;
  return markers.map((marker) => ({
    time: stamp(marker.time),
    position: marker.position,
    shape: marker.shape,
    text: marker.text,
    color: marker.color ?? "#b08948",
  }));
}

export function PriceChart({ symbol, initial, bars }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const [range, setRange] = useState(initial?.range ?? "3M");
  const [meta, setMeta] = useState(() => ({
    source: initial?.source ?? "Halcyon",
    status: initial?.status ?? "Stale",
    detail: initial?.detail ?? (bars?.length ? "Seeded path." : "Loading chart…"),
    asOf: initial?.asOf ?? "",
  }));
  const [loading, setLoading] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    const ink = styles.getPropertyValue("--ink").trim() || "#1c1914";
    const bg = styles.getPropertyValue("--bg").trim() || "#f4f0e6";
    const line = styles.getPropertyValue("--line").trim() || "#d4cbbd";
    const muted = styles.getPropertyValue("--muted").trim() || "#5a5348";
    const gold = styles.getPropertyValue("--gold-bright").trim() || "#b08948";
    const profit = styles.getPropertyValue("--profit").trim() || "#0f5c38";
    const loss = styles.getPropertyValue("--loss").trim() || "#8d2f2a";

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: bg },
        textColor: muted,
        fontFamily: "IBM Plex Mono, ui-monospace, monospace",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: line },
        horzLines: { color: line },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: gold, labelBackgroundColor: ink },
        horzLine: { color: gold, labelBackgroundColor: ink },
      },
      rightPriceScale: { borderColor: line },
      timeScale: { borderColor: line, timeVisible: true, secondsVisible: false },
      handleScroll: !reduceMotion.current,
      handleScale: !reduceMotion.current,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: profit,
      downColor: loss,
      borderUpColor: profit,
      borderDownColor: loss,
      wickUpColor: profit,
      wickDownColor: loss,
    });
    markersRef.current = createSeriesMarkers(series, []);
    chartRef.current = chart;
    seriesRef.current = series;

    const seedBars = initial?.bars?.length ? initial.bars : bars;
    const seedMarkers = initial?.markers ?? [];
    if (seedBars?.length) {
      const intraday = (initial?.range ?? range) === "1D" || (initial?.range ?? range) === "5D";
      series.setData(mapBars(seedBars, intraday));
      markersRef.current.setMarkers(mapMarkers(seedMarkers, intraday));
      chart.timeScale().fitContent();
    }

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch(`/api/v1/markets/bars?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`, {
          headers: { "x-halcyon-request": "1" },
        });
        const body = await response.json();
        const chart: ChartSeries | undefined = body.chart;
        if (cancelled || !seriesRef.current) return;
        if (!chart?.bars?.length) {
          if (initial?.bars?.length) {
            const intraday = range === "1D" || range === "5D";
            seriesRef.current.setData(mapBars(initial.bars, intraday));
            markersRef.current?.setMarkers(mapMarkers(initial.markers ?? [], intraday));
            chartRef.current?.timeScale().fitContent();
          }
          return;
        }
        const intraday = chart.range === "1D" || chart.range === "5D" || range === "1D" || range === "5D";
        seriesRef.current.setData(mapBars(chart.bars, intraday));
        markersRef.current?.setMarkers(mapMarkers(chart.markers ?? [], intraday));
        chartRef.current?.timeScale().fitContent();
        setMeta({
          source: chart.source,
          status: chart.status,
          detail: chart.detail ?? "",
          asOf: chart.asOf,
        });
      } catch {
        if (!cancelled) setMeta((prev) => ({ ...prev, detail: prev.detail || "Chart refresh failed. Showing last path." }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, initial]);

  return (
    <section className="desk-chart" aria-label={`${symbol} price chart`}>
      <div className="chart-toolbar">
        <div className="chart-ranges" role="group" aria-label="Chart range">
          {RANGES.map((item) => (
            <button
              key={item}
              type="button"
              className={item === range ? "btn-solid" : "btn-line"}
              aria-pressed={item === range}
              onClick={() => setRange(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <p className="meta">
          <span className="pill">{meta.status}</span> {meta.source}
          {loading ? " · refreshing…" : null}
        </p>
      </div>
      <div ref={host} className="chart tv-chart" role="img" aria-label={`${symbol} candlestick chart`} />
      {meta.detail ? <p className="meta chart-note">{meta.detail}</p> : null}
    </section>
  );
}
