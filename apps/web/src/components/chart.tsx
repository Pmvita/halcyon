"use client";

import { useEffect, useRef } from "react";
import type { Bar } from "@halcyon/domain";

export function PriceChart({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || bars.length < 2) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    const styles = getComputedStyle(canvas);
    const ink = styles.color || "#1c1914";
    const line = styles.getPropertyValue("--line") || "#d4cbbd";
    const gold = styles.getPropertyValue("--gold-bright") || "#b08948";
    ctx.clearRect(0, 0, width, height);
    const highs = bars.map((bar) => bar.h);
    const lows = bars.map((bar) => bar.l);
    const max = Math.max(...highs);
    const min = Math.min(...lows);
    const span = max - min || 1;
    const x = (index: number) => (index / (bars.length - 1)) * (width - 24) + 12;
    const y = (value: number) => 16 + ((max - value) / span) * (height - 48);
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(12, height - 28);
    ctx.lineTo(width - 12, height - 28);
    ctx.stroke();
    ctx.strokeStyle = gold;
    ctx.beginPath();
    bars.forEach((bar, index) => {
      const px = x(index);
      if (index === 0) ctx.moveTo(px, y(bar.c));
      else ctx.lineTo(px, y(bar.c));
    });
    ctx.stroke();
    ctx.strokeStyle = ink;
    const last = bars[bars.length - 1]!;
    ctx.fillStyle = ink;
    ctx.font = "12px IBM Plex Mono, monospace";
    ctx.fillText(last.c.toFixed(2), 12, 14);
    const move = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const index = Math.round(((event.clientX - rect.left) / rect.width) * (bars.length - 1));
      const bar = bars[Math.max(0, Math.min(bars.length - 1, index))];
      if (!bar) return;
      canvas.setAttribute("aria-label", `Open ${bar.o.toFixed(2)}, high ${bar.h.toFixed(2)}, low ${bar.l.toFixed(2)}, close ${bar.c.toFixed(2)}`);
    };
    canvas.addEventListener("pointermove", move);
    return () => canvas.removeEventListener("pointermove", move);
  }, [bars]);
  return <canvas ref={ref} className="chart" role="img" aria-label="Price chart" />;
}
