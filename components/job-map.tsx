"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import { getCityCoordinates, type Coordinates } from "@/lib/job-location";
import type { JobPost } from "@/lib/types";

interface LocatedJob {
  job: JobPost;
  coordinates: Coordinates;
}

interface JobMapProps {
  jobs: JobPost[];
  userCoordinates: Coordinates | null;
}

const STOCKHOLM: Coordinates = { longitude: 18.0686, latitude: 59.3293 };

function distanceBetween(from: Coordinates | null, to: Coordinates): string | null {
  if (!from) return null;
  const radius = 6371;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  const km = radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return km < 1 ? `${Math.max(100, Math.round(km * 10) * 100)} m bort` : `${km.toFixed(km < 10 ? 1 : 0).replace(".", ",")} km bort`;
}

export function JobMap({ jobs, userCoordinates }: JobMapProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [locatedJobs, setLocatedJobs] = useState<LocatedJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    let cancelled = false;

    const items = jobs.map((job) => {
      const coordinates = typeof job.longitude === "number" && typeof job.latitude === "number"
        ? { longitude: job.longitude, latitude: job.latitude }
        : getCityCoordinates(job.city);
      return coordinates ? { job, coordinates } : null;
    });
    if (!cancelled) setLocatedJobs(items.filter((item): item is LocatedJob => item !== null));

    return () => { cancelled = true; };
  }, [jobs]);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    if (!mapboxgl.supported()) {
      setMapError("Din webbläsare saknar stöd för WebGL, som behövs för att visa kartan.");
      return;
    }

    mapboxgl.accessToken = token;
    // Mapbox owns this node. Clearing it here also makes Fast Refresh and
    // React's development mount cycle safe for the WebGL canvas.
    const container = mapContainer.current;
    container.replaceChildren();
    const map = new mapboxgl.Map({
      container,
      style: process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12",
      center: [STOCKHOLM.longitude, STOCKHOLM.latitude],
      zoom: 5.3,
      pitch: 0,
      cooperativeGestures: true,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    let styleLoaded = false;
    const loadTimeout = window.setTimeout(() => {
      if (!styleLoaded) setMapError("Mapbox svarade inte. Kontrollera tokenens URL-begränsningar och försök igen.");
    }, 15000);

    map.once("style.load", () => {
      styleLoaded = true;
      window.clearTimeout(loadTimeout);
      setMapReady(true);
      setMapError("");
    });
    map.on("error", (event) => {
      const message = event.error?.message || "Kartan kunde inte laddas.";
      const status = (event.error as Error & { status?: number }).status;
      if (status === 401 || status === 403 || /unauthorized|forbidden|access token|style.*not found/i.test(message)) {
        setMapError("Mapbox svarade 403 för kartdata. Kontrollera att tokenen är nygenererad med tile-åtkomst och att Mapbox-kontot är aktivt.");
      }
    });
    map.on("click", () => setActiveJobId(null));
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      window.clearTimeout(loadTimeout);
      map.remove();
      container.replaceChildren();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = locatedJobs.map(({ job, coordinates }) => {
      const isExpanded = job.id === activeJobId;
      const markerElement = document.createElement("div");
      markerElement.className = `job-map-marker${isExpanded ? " is-expanded" : ""}`;
      markerElement.innerHTML = `
        <section class="job-map-card" aria-hidden="${!isExpanded}">
          <button type="button" class="job-map-close" aria-label="Stäng ${job.title}">×</button>
          <p class="job-map-company">${escapeHtml(job.company_name || "Företag")}</p>
          <h2>${escapeHtml(job.title)}</h2>
          <div class="job-map-meta">
            <span>${escapeHtml(job.salary_per_hour || "Lön enligt överenskommelse")}</span>
            ${distanceBetween(userCoordinates, coordinates) ? `<span>${distanceBetween(userCoordinates, coordinates)}</span>` : ""}
          </div>
          <button type="button" class="job-map-cta">Visa jobbet <span aria-hidden="true">→</span></button>
        </section>
        <button type="button" class="job-map-pin" aria-label="${escapeHtml(job.title)}, ${escapeHtml(job.company_name || "Företag")}" aria-expanded="${isExpanded}">
          <span aria-hidden="true">⌖</span>
        </button>
      `;

      const toggle = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveJobId((current) => current === job.id ? null : job.id);
      };
      markerElement.querySelector(".job-map-pin")?.addEventListener("click", toggle);
      markerElement.querySelector(".job-map-close")?.addEventListener("click", toggle);
      markerElement.querySelector(".job-map-cta")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        router.push(`/jobb/${encodeURIComponent(job.id)}`);
      });

      if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        markerElement.addEventListener("mouseenter", () => setActiveJobId(job.id));
      }

      return new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);
    });

    if (!activeJobId && locatedJobs.length) {
      if (locatedJobs.length === 1) {
        const location = locatedJobs[0].coordinates;
        map.easeTo({ center: [location.longitude, location.latitude], zoom: 11, duration: 350 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        locatedJobs.forEach(({ coordinates }) => bounds.extend([coordinates.longitude, coordinates.latitude]));
        map.fitBounds(bounds, { padding: { top: 110, right: 80, bottom: 130, left: 80 }, maxZoom: 11, duration: 0 });
      }
    }
  }, [activeJobId, locatedJobs, mapReady, router, userCoordinates]);

  if (!token) {
    return (
      <div className="job-map-token-message">
        <span>⌖</span>
        <h2>Aktivera din karta</h2>
        <p>Lägg till <code>NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> i <code>.env.local</code> och starta om appen.</p>
      </div>
    );
  }

  return (
    <div className="job-map-surface">
      <div ref={mapContainer} className="job-map-canvas" aria-label="Karta med lediga jobb" />
      {!mapReady && !mapError && <div className="job-map-status">Laddar kartan...</div>}
      {mapError && <div className="job-map-status job-map-status-error">{mapError}</div>}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}
