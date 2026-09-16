"use client";

import { useId, useState } from "react";

import { formatThaiDateShort } from "@/lib/format";

type Point = { day: string; n: number };

/**
 * Single-series daily bar chart. One hue (brand), thin marks with rounded
 * tops anchored to the baseline, a 2px gap between bars, per-bar hover
 * tooltip, and a sr-only table so the numbers are readable without the plot.
 */
export function DailyBars({ title, data, unit }: { title: string; data: Point[]; unit: string }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const W = 560;
  const H = 160;
  const padT = 18;
  const padB = 22;
  const max = Math.max(1, ...data.map((d) => d.n));
  const gap = 2;
  const bw = (W - gap * (data.length - 1)) / data.length;
  const plotH = H - padT - padB;
  const total = data.reduce((a, b) => a + b.n, 0);
  const last = data[data.length - 1];

  return (
    <figure className="flex flex-col gap-2" aria-labelledby={`${id}-t`}>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span id={`${id}-t`} className="text-[15px] font-medium text-ink">
          {title}
        </span>
        <span className="text-[13.5px] text-ink3">
          {data.length} วันล่าสุด รวม <span className="tabular font-medium text-ink">{total}</span> {unit}
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}: ${data.length} วันล่าสุด`}>
          <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke="var(--border)" strokeWidth={1} />
          {data.map((d, i) => {
            const x = i * (bw + gap);
            const h = Math.max(d.n > 0 ? 3 : 0, (d.n / max) * plotH);
            const y = H - padB - h;
            const r = Math.min(4, bw / 2, h);
            const isHover = hover === i;
            const isLast = i === data.length - 1;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
                {/* hit target larger than the mark */}
                <rect x={x} y={0} width={bw} height={H} fill="transparent" />
                {h > 0 ? (
                  <path
                    d={`M${x},${H - padB} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${bw - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`}
                    fill="var(--brand)"
                    opacity={hover === null || isHover ? 1 : 0.55}
                  />
                ) : null}
                {(isLast || isHover) && d.n > 0 ? (
                  <text x={x + bw / 2} y={y - 5} textAnchor="middle" fontSize={11} fill="var(--ink2)" className="tabular">
                    {d.n}
                  </text>
                ) : null}
                {(i === 0 || isLast || i === Math.floor(data.length / 2)) ? (
                  <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={10.5} fill="var(--ink3)">
                    {formatThaiDateShort(d.day + "T00:00:00+07:00")}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {hover !== null && data[hover] ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute -top-1 rounded-[10px] border border-border bg-card px-2.5 py-1.5 text-[13px] shadow-m"
            style={{ left: `${((hover + 0.5) / data.length) * 100}%`, transform: "translate(-50%, -100%)" }}
          >
            <span className="text-ink3">{formatThaiDateShort(data[hover].day + "T00:00:00+07:00")}</span>{" "}
            <span className="tabular font-medium text-ink">{data[hover].n}</span> {unit}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>วัน</th>
            <th>{unit}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.day}>
              <td>{d.day}</td>
              <td>{d.n}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {last ? <p className="sr-only">ล่าสุด {last.n} {unit}</p> : null}
    </figure>
  );
}
