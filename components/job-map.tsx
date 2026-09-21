"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import mapboxgl from "mapbox-gl";
import { getCityCoordinates, type Coordinates } from "@/lib/job-location";
import type { JobPost } from "@/lib/types";

interface LocatedJob {
  job: JobPost;
  coordinates: Coordinates;
  hasPreciseCoordinates: boolean;
}

interface JobCluster {
  id: string;
  jobs: LocatedJob[];
  coordinates: Coordinates;
}

interface JobMapProps {
  jobs: JobPost[];
  userCoordinates: Coordinates | null;
}

const STOCKHOLM: Coordinates = { longitude: 18.0686, latitude: 59.3293 };
const MAX_VISIBLE_CLUSTER_CARDS = 3;

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

function distanceInMeters(from: Coordinates, to: Coordinates): number {
  const radius = 6371000;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = radians(to.latitude - from.latitude);
  const deltaLongitude = radians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function addressKey(job: JobPost): string | null {
  const address = job.address?.trim().toLocaleLowerCase("sv-SE");
  return address ? [address, job.postal_code, job.city].filter(Boolean).join("|").toLocaleLowerCase("sv-SE") : null;
}

function cityKey(job: JobPost): string | null {
  const city = job.city?.trim().toLocaleLowerCase("sv-SE");
  return city || null;
}

function clusterNearbyJobs(jobs: LocatedJob[]): JobCluster[] {
  const groups: LocatedJob[][] = [];

  jobs.forEach((item) => {
    const itemAddress = addressKey(item.job);
    const matchingGroup = groups.find((group) => group.some((candidate) => {
      const candidateAddress = addressKey(candidate.job);
      const sameAddress = itemAddress !== null && itemAddress === candidateAddress;
      const sameFallbackCity = !item.hasPreciseCoordinates
        && !candidate.hasPreciseCoordinates
        && cityKey(item.job) !== null
        && cityKey(item.job) === cityKey(candidate.job);
      const nearbyPreciseLocations = item.hasPreciseCoordinates
        && candidate.hasPreciseCoordinates
        && distanceInMeters(item.coordinates, candidate.coordinates) <= 75;
      return sameAddress || sameFallbackCity || nearbyPreciseLocations;
    }));

    if (matchingGroup) matchingGroup.push(item);
    else groups.push([item]);
  });

  return groups.map((group) => ({
    id: group.map(({ job }) => job.id).join(","),
    jobs: group,
    coordinates: {
      longitude: group.reduce((total, item) => total + item.coordinates.longitude, 0) / group.length,
      latitude: group.reduce((total, item) => total + item.coordinates.latitude, 0) / group.length,
    },
  }));
}

// Warm, low-contrast palette applied on top of Mapbox's light basemap so the
// canvas recedes and the job pins carry the colour. Matches the paper/ink feel
// of the reference startup map without depending on a hosted custom style.
const MAP_PALETTE = {
  land: "#F7F4ED",
  landSecondary: "#F1ECE1",
  water: "#DFE6E6",
  waterLabel: "#93A4A6",
  park: "#E9EBDD",
  building: "#EDE7DA",
  road: "#FFFFFF",
  roadCasing: "#E8E1D3",
  boundary: "#DDD5C6",
  label: "#6B6259",
  labelHalo: "#F7F4ED",
};

function applyWarmMapTheme(map: mapboxgl.Map) {
  const style = map.getStyle();

  // Mapbox Standard styles expose no editable layers — their basemap is an
  // import that is tuned through config properties instead. "faded" is the
  // muted, low-contrast preset that lets the pins carry the colour.
  if (style?.imports?.some((entry) => entry.id === "basemap")) {
    try {
      map.setConfigProperty("basemap", "theme", "faded");
      map.setConfigProperty("basemap", "lightPreset", "day");
      map.setConfigProperty("basemap", "showPointOfInterestLabels", false);
      map.setConfigProperty("basemap", "showTransitLabels", false);
      map.setConfigProperty("basemap", "show3dObjects", false);
    } catch {
      // An older Standard import may not expose every config key.
    }
    return;
  }

  const layers = style?.layers ?? [];
  layers.forEach((layer) => {
    const id = layer.id;
    try {
      if (/poi-label|transit-label|airport-label/.test(id)) {
        map.setLayoutProperty(id, "visibility", "none");
        return;
      }
      if (layer.type === "background") {
        map.setPaintProperty(id, "background-color", MAP_PALETTE.land);
      } else if (layer.type === "fill") {
        if (/water/.test(id)) map.setPaintProperty(id, "fill-color", MAP_PALETTE.water);
        else if (/park|grass|wood|forest|golf|pitch|sand|scrub/.test(id)) map.setPaintProperty(id, "fill-color", MAP_PALETTE.park);
        else if (/building/.test(id)) map.setPaintProperty(id, "fill-color", MAP_PALETTE.building);
        else map.setPaintProperty(id, "fill-color", MAP_PALETTE.landSecondary);
      } else if (layer.type === "line") {
        if (/water/.test(id)) map.setPaintProperty(id, "line-color", MAP_PALETTE.water);
        else if (/admin|boundary/.test(id)) map.setPaintProperty(id, "line-color", MAP_PALETTE.boundary);
        else if (/case|casing/.test(id)) map.setPaintProperty(id, "line-color", MAP_PALETTE.roadCasing);
        else map.setPaintProperty(id, "line-color", MAP_PALETTE.road);
      } else if (layer.type === "fill-extrusion") {
        map.setPaintProperty(id, "fill-extrusion-color", MAP_PALETTE.building);
      } else if (layer.type === "symbol") {
        map.setPaintProperty(id, "text-color", /water|marine/.test(id) ? MAP_PALETTE.waterLabel : MAP_PALETTE.label);
        map.setPaintProperty(id, "text-halo-color", MAP_PALETTE.labelHalo);
        map.setPaintProperty(id, "text-halo-width", 1.3);
      }
    } catch {
      // A layer without the paint property we assumed simply keeps its own.
    }
  });
}

function thumbnailUrl(job: JobPost): string {
  return job.image_url?.split(",")[0]?.trim() ?? "";
}

function companyInitials(name: string | null | undefined): string {
  return (name?.trim() || "Jobb")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toLocaleUpperCase("sv-SE");
}

function pinTileMarkup(job: JobPost): string {
  const source = thumbnailUrl(job);
  return `<span class="job-map-pin-tile"><span class="job-map-pin-initials">${escapeHtml(companyInitials(job.company_name))}</span>${source ? `<img src="${escapeHtml(source)}" alt="" loading="lazy" decoding="async" />` : ""}</span>`;
}

export function JobMap({ jobs, userCoordinates }: JobMapProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const lastViewportClusterKeyRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [clusterCardStarts, setClusterCardStarts] = useState<Record<string, number>>({});
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  const locatedJobs = useMemo(() => jobs.map((job) => {
      const hasPreciseCoordinates = typeof job.longitude === "number" && typeof job.latitude === "number";
      const coordinates = hasPreciseCoordinates
        ? { longitude: job.longitude, latitude: job.latitude }
        : getCityCoordinates(job.city);
      return coordinates ? { job, coordinates, hasPreciseCoordinates } : null;
    }).filter((item): item is LocatedJob => item !== null), [jobs]);

  const jobClusters = useMemo(() => clusterNearbyJobs(locatedJobs), [locatedJobs]);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    if (!mapboxgl.supported()) {
      queueMicrotask(() => setMapError("Din webbläsare saknar stöd för WebGL, som behövs för att visa kartan."));
      return;
    }

    mapboxgl.accessToken = token;
    const container = mapContainer.current;
    container.replaceChildren();
    const map = new mapboxgl.Map({
      container,
      style: process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/streets-v12",
      center: [STOCKHOLM.longitude, STOCKHOLM.latitude],
      zoom: 5.3,
      pitch: 0,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    let styleLoaded = false;
    const loadTimeout = window.setTimeout(() => {
      if (!styleLoaded) setMapError("Mapbox svarade inte. Kontrollera tokenens URL-begränsningar och försök igen.");
    }, 15000);

    map.once("style.load", () => {
      styleLoaded = true;
      window.clearTimeout(loadTimeout);
      // Recolours whatever style is configured into the paper palette. Set
      // NEXT_PUBLIC_MAPBOX_KEEP_STYLE_COLORS=true to keep a hand-made style's
      // own colours instead.
      if (process.env.NEXT_PUBLIC_MAPBOX_KEEP_STYLE_COLORS !== "true") applyWarmMapTheme(map);
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
    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRef.current?.remove();
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
    markersRef.current = jobClusters.map((cluster) => {
      const { id: clusterId, jobs: clusterJobs, coordinates } = cluster;
      const isCluster = clusterJobs.length > 1;
      const leadJob = clusterJobs[0].job;
      const markerElement = document.createElement("div");
      markerElement.className = `job-map-marker${isCluster ? " is-cluster" : ""}`;
      markerElement.dataset.clusterId = clusterId;
      const pinLabel = isCluster
        ? `${clusterJobs.length} jobbannonser på samma plats`
        : `${leadJob.title}, ${leadJob.company_name || "Företag"}`;
      const chipLabel = isCluster ? `${clusterJobs.length} jobb` : (leadJob.company_name || "Företag");
      markerElement.innerHTML = `
        <button type="button" class="job-map-pin" aria-label="${escapeHtml(pinLabel)}" aria-expanded="false">
          ${isCluster ? `<span class="job-map-pin-count" aria-hidden="true">${clusterJobs.length}</span>` : pinTileMarkup(leadJob)}
        </button>
        <span class="job-map-pin-chip" aria-hidden="true">${escapeHtml(chipLabel)}</span>
      `;
      // A photo that fails to load uncovers the company initials underneath.
      markerElement.querySelector("img")?.addEventListener("error", (event) => (event.currentTarget as HTMLImageElement).remove());

      const toggle = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveClusterId((current) => current === clusterId ? null : clusterId);
      };
      markerElement.querySelector(".job-map-pin")?.addEventListener("click", toggle);
      markerElement.querySelector(".job-map-pin")?.addEventListener("pointerenter", () => {
        setActiveClusterId(clusterId);
      });

      // Keep Mapbox's anchor independent from our expandable DOM UI. The
      // element is a 1px coordinate anchor; CSS centres the circular pin on it
      // and hangs the name chip below, so styling never moves the geo point.
      return new mapboxgl.Marker({ element: markerElement, anchor: "center" })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);
    });
  }, [jobClusters, mapReady]);

  // Lift the open pin above its neighbours and keep aria-expanded truthful.
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const element = marker.getElement();
      const isActive = element.dataset.clusterId === activeClusterId;
      element.classList.toggle("is-expanded", isActive);
      element.style.zIndex = isActive ? "5" : "";
      element.querySelector(".job-map-pin")?.setAttribute("aria-expanded", String(isActive));
    });
  }, [activeClusterId, jobClusters]);

  useEffect(() => {
    const map = mapRef.current;
    const activeCluster = jobClusters.find(({ id }) => id === activeClusterId);
    popupRef.current?.remove();
    popupRef.current = null;
    if (!map || !mapReady || !activeCluster) return;

    const { id: clusterId, jobs: clusterJobs, coordinates } = activeCluster;
    const visibleCardCount = Math.min(clusterJobs.length, MAX_VISIBLE_CLUSTER_CARDS);
    const maxCardStart = Math.max(0, clusterJobs.length - visibleCardCount);
    const cardStart = Math.min(clusterCardStarts[clusterId] ?? 0, maxCardStart);
    const visibleJobs = clusterJobs.slice(cardStart, cardStart + visibleCardCount);
    const cardWidth = visibleCardCount === 1 ? "min(16.4rem, 76vw)" : visibleCardCount === 2 ? "min(14rem, calc((100vw - 2.5rem) / 2))" : "min(11.5rem, calc((100vw - 3rem) / 3))";
    const content = document.createElement("div");
    content.className = "job-map-popup-content";
    content.style.setProperty("--job-map-card-width", cardWidth);
    content.innerHTML = `<section class="job-map-cluster-cards"><button type="button" class="job-map-close" aria-label="Stäng jobbannonserna">×</button>${cardStart > 0 ? '<button type="button" class="job-map-cluster-arrow job-map-cluster-previous" aria-label="Visa tidigare annonser">‹</button>' : ""}<div class="job-map-card-list">${visibleJobs.map(({ job, coordinates: jobCoordinates }) => `<article class="job-map-card"><header class="job-map-card-head">${pinTileMarkup(job)}<p class="job-map-company">${escapeHtml(job.company_name || "Företag")}</p></header><h2>${escapeHtml(job.title)}</h2><div class="job-map-meta"><span>${escapeHtml(job.salary_per_hour || "Lön enligt överenskommelse")}</span>${distanceBetween(userCoordinates, jobCoordinates) ? `<span>${distanceBetween(userCoordinates, jobCoordinates)}</span>` : ""}</div><button type="button" class="job-map-cta" data-job-id="${escapeHtml(job.id)}">Visa jobbet <span aria-hidden="true">→</span></button></article>`).join("")}</div>${cardStart < maxCardStart ? '<button type="button" class="job-map-cluster-arrow job-map-cluster-next" aria-label="Visa fler annonser">›</button>' : ""}</section>`;

    const close = () => setActiveClusterId((current) => current === clusterId ? null : current);
    content.querySelector(".job-map-close")?.addEventListener("click", close);
    content.querySelector(".job-map-cluster-previous")?.addEventListener("click", () => setClusterCardStarts((current) => ({ ...current, [clusterId]: Math.max(0, cardStart - 1) })));
    content.querySelector(".job-map-cluster-next")?.addEventListener("click", () => setClusterCardStarts((current) => ({ ...current, [clusterId]: Math.min(maxCardStart, cardStart + 1) })));
    content.querySelectorAll<HTMLButtonElement>(".job-map-cta").forEach((button) => button.addEventListener("click", () => router.push(`/jobb/${encodeURIComponent(button.dataset.jobId || "")}`)));

    const popup = new mapboxgl.Popup({ className: "job-map-popup", closeButton: false, closeOnClick: false, maxWidth: "none", offset: [0, -30] })
      .setLngLat([coordinates.longitude, coordinates.latitude])
      .setDOMContent(content)
      .addTo(map);
    popupRef.current = popup;
    return () => {
      popup.remove();
    };
  }, [activeClusterId, clusterCardStarts, jobClusters, mapReady, router, userCoordinates]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !jobClusters.length) return;
    const viewportKey = jobClusters.map(({ id, coordinates }) => `${id}:${coordinates.longitude.toFixed(5)},${coordinates.latitude.toFixed(5)}`).join("|");
    if (lastViewportClusterKeyRef.current === viewportKey) return;
    lastViewportClusterKeyRef.current = viewportKey;

    // Fit only when the actual job set changes, never when a pin/card is clicked.
    if (jobClusters.length === 1) {
      const location = jobClusters[0].coordinates;
      map.easeTo({ center: [location.longitude, location.latitude], zoom: 11, duration: 350 });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      jobClusters.forEach(({ coordinates }) => bounds.extend([coordinates.longitude, coordinates.latitude]));
      map.fitBounds(bounds, { padding: { top: 110, right: 80, bottom: 130, left: 80 }, maxZoom: 11, duration: 0 });
    }
  }, [jobClusters, mapReady]);

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
