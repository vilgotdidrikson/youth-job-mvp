"use client";

import { useEffect, useRef, useState } from "react";
import type { YouthJob } from "@/lib/youth-demo-data";

const coordinates: Record<string, [number, number]> = {
  cafe: [18.064, 59.315],
  shop: [18.049, 59.345],
  event: [18.154, 59.31],
  bistro: [18.079, 59.312],
  park: [18.026, 59.333],
  sports: [18.164, 59.322],
  cinema: [18.066, 59.347],
  bakery: [18.045, 59.298],
};
// Web Mercator, matching the public raster tiles. No location permission needed.
function project([longitude, latitude]: [number, number], zoom: number) {
  const scale = 256 * 2 ** zoom;
  const sine = Math.sin((latitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}
export function DemoJobMap({
  jobs,
  onOpen,
}: {
  jobs: YouthJob[];
  onOpen: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const pointer = useRef<{
    x: number;
    y: number;
    center: { x: number; y: number };
  } | null>(null);
  const [size, setSize] = useState({ width: 390, height: 600 });
  const [view, setView] = useState(() => ({
    zoom: 11,
    center: project([18.082, 59.323], 11),
  }));
  const [selected, setSelected] = useState(jobs[0]?.id);
  const [failed, setFailed] = useState(false);
  const active = jobs.find((job) => job.id === selected) || jobs[0];
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const left = view.center.x - size.width / 2;
  const top = view.center.y - size.height / 2;
  const tiles = [];
  for (
    let y = Math.floor(top / 256);
    y <= Math.floor((top + size.height) / 256);
    y++
  ) {
    for (
      let x = Math.floor(left / 256);
      x <= Math.floor((left + size.width) / 256);
      x++
    ) {
      tiles.push(
        <img
          key={`${view.zoom}/${x}/${y}`}
          alt=""
          draggable={false}
          className="yd-map-tile"
          src={`https://tile.openstreetmap.org/${view.zoom}/${x}/${y}.png`}
          width={256}
          height={256}
          style={{ left: x * 256 - left, top: y * 256 - top }}
          onError={() => setFailed(true)}
        />,
      );
    }
  }
  function zoom(delta: number) {
    setView((current) => {
      const next = Math.max(10, Math.min(15, current.zoom + delta));
      const scale = 2 ** (next - current.zoom);
      return {
        zoom: next,
        center: { x: current.center.x * scale, y: current.center.y * scale },
      };
    });
  }
  function select(id: string) {
    setSelected(id);
    setView((current) => ({
      ...current,
      center: project(coordinates[id], current.zoom),
    }));
  }
  return (
    <div className="yd-map-wrap">
      <div
        ref={container}
        className="yd-map-canvas yd-raster-map"
        role="region"
        aria-label="Jobbkarta över Stockholm"
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button,a")) return;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            center: view.center,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = pointer.current;
          if (start)
            setView((current) => ({
              ...current,
              center: {
                x: start.center.x - event.clientX + start.x,
                y: start.center.y - event.clientY + start.y,
              },
            }));
        }}
        onPointerUp={() => {
          pointer.current = null;
        }}
        onPointerCancel={() => {
          pointer.current = null;
        }}
      >
        {tiles}
        {jobs.map((job) => {
          const point = project(coordinates[job.id], view.zoom);
          return (
            <button
              key={job.id}
              className="yd-map-pin"
              style={{ left: point.x - left, top: point.y - top }}
              aria-label={`${job.title} hos ${job.company}`}
              aria-pressed={active?.id === job.id}
              onClick={() => select(job.id)}
            >
              {job.mark}
            </button>
          );
        })}
      </div>
      <div className="yd-map-controls">
        <button
          aria-label="Zooma in på kartan"
          disabled={view.zoom === 15}
          onClick={() => zoom(1)}
        >
          +
        </button>
        <button
          aria-label="Zooma ut på kartan"
          disabled={view.zoom === 10}
          onClick={() => zoom(-1)}
        >
          −
        </button>
        <button
          aria-label="Centrera kartan över Stockholm"
          onClick={() =>
            setView({ zoom: 11, center: project([18.082, 59.323], 11) })
          }
        >
          ⌖
        </button>
      </div>
      {failed && (
        <div className="yd-map-state" role="status">
          Bakgrundskartan kunde inte laddas. Du kan fortfarande välja jobben.
        </div>
      )}
      <div className="yd-map-job-picker" aria-label="Välj jobb på kartan">
        {jobs.map((job) => (
          <button
            aria-pressed={active?.id === job.id}
            key={job.id}
            onClick={() => select(job.id)}
          >
            {job.company}
          </button>
        ))}
      </div>
      {active && (
        <button className="yd-map-card" onClick={() => onOpen(active.id)}>
          <span className={`dx-emblem ${active.tone}`}>{active.mark}</span>
          <span>
            <small>
              {active.company} · {active.area}
            </small>
            <strong>{active.title}</strong>
            <small>{active.hours}</small>
          </span>
          <span>→</span>
        </button>
      )}
      <a
        className="yd-map-attribution"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}
