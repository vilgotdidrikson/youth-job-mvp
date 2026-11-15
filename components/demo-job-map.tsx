"use client";
import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
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
export function DemoJobMap({
  jobs,
  onOpen,
}: {
  jobs: YouthJob[];
  onOpen: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(jobs[0]?.id);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const active = jobs.find((j) => j.id === selected) || jobs[0];
  useEffect(() => {
    if (!container.current) return;
    let map: mapboxgl.Map | undefined;
    try {
      const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
      map = new mapboxgl.Map({
        container: container.current,
        accessToken: token,
        style: token
          ? "mapbox://styles/mapbox/light-v11"
          : {
              version: 8,
              sources: {
                osm: {
                  type: "raster",
                  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
                  tileSize: 256,
                  attribution:
                    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                },
              },
              layers: [{ id: "osm", type: "raster", source: "osm" }],
            },
        center: [18.082, 59.323],
        zoom: 10.8,
        attributionControl: true,
      });
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.on("load", () => setLoading(false));
      map.on("error", () => {
        setFailed(true);
        setLoading(false);
      });
      const bounds = new mapboxgl.LngLatBounds();
      jobs.forEach((job) => {
        const point = coordinates[job.id];
        if (!point) return;
        bounds.extend(point);
        const pin = document.createElement("button");
        pin.className = "yd-map-pin";
        pin.textContent = job.mark;
        pin.setAttribute("aria-label", `${job.title} hos ${job.company}`);
        pin.addEventListener("click", () => {
          setSelected(job.id);
          map?.easeTo({ center: point, duration: 350 });
        });
        new mapboxgl.Marker({ element: pin }).setLngLat(point).addTo(map!);
      });
      if (jobs.length)
        map.fitBounds(bounds, {
          padding: { top: 60, right: 45, bottom: 180, left: 45 },
          maxZoom: 12,
          duration: 0,
        });
      const observer = new ResizeObserver(() => map?.resize());
      observer.observe(container.current);
      return () => {
        observer.disconnect();
        map?.remove();
      };
    } catch {
      setFailed(true);
      setLoading(false);
      map?.remove();
    }
  }, [jobs]);
  return (
    <div className="yd-map-wrap">
      <div
        ref={container}
        className="yd-map-canvas"
        aria-label="Jobbkarta över Stockholm"
      />
      {loading && (
        <div className="yd-map-state" role="status">
          Laddar kartan…
        </div>
      )}
      {failed && (
        <div className="yd-map-state" role="status">
          Kartan kunde inte laddas. Välj ett jobb nedan.
        </div>
      )}
      <div className="yd-map-job-picker" aria-label="Välj jobb på kartan">
        {jobs.map((j) => (
          <button
            aria-pressed={active?.id === j.id}
            key={j.id}
            onClick={() => setSelected(j.id)}
          >
            {j.company}
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
    </div>
  );
}
