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

export function JobMap({ jobs, userCoordinates }: JobMapProps) {
  const router = useRouter();
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const outsideHoverCloseTimer = useRef<number | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [locatedJobs, setLocatedJobs] = useState<LocatedJob[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [clusterCardStarts, setClusterCardStarts] = useState<Record<string, number>>({});
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    const items = jobs.map((job) => {
      const hasPreciseCoordinates = typeof job.longitude === "number" && typeof job.latitude === "number";
      const coordinates = hasPreciseCoordinates
        ? { longitude: job.longitude, latitude: job.latitude }
        : getCityCoordinates(job.city);
      return coordinates ? { job, coordinates, hasPreciseCoordinates } : null;
    });
    setLocatedJobs(items.filter((item): item is LocatedJob => item !== null));
  }, [jobs]);

  const jobClusters = useMemo(() => clusterNearbyJobs(locatedJobs), [locatedJobs]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const marker = event.target instanceof Element
        ? event.target.closest<HTMLElement>(".job-map-marker")
        : null;
      const clusterId = marker?.dataset.clusterId;

      if (clusterId) {
        if (outsideHoverCloseTimer.current !== null) {
          window.clearTimeout(outsideHoverCloseTimer.current);
          outsideHoverCloseTimer.current = null;
        }
        setActiveClusterId((current) => current === clusterId ? current : clusterId);
        return;
      }

      if (outsideHoverCloseTimer.current === null) {
        outsideHoverCloseTimer.current = window.setTimeout(() => {
          setActiveClusterId(null);
          outsideHoverCloseTimer.current = null;
        }, 140);
      }
    };

    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      if (outsideHoverCloseTimer.current !== null) window.clearTimeout(outsideHoverCloseTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    if (!mapboxgl.supported()) {
      setMapError("Din webbläsare saknar stöd för WebGL, som behövs för att visa kartan.");
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
    map.on("click", () => setActiveClusterId(null));
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
    markersRef.current = jobClusters.map((cluster) => {
      const { id: clusterId, jobs: clusterJobs, coordinates } = cluster;
      const isExpanded = activeClusterId === clusterId;
      const visibleCardCount = Math.min(clusterJobs.length, MAX_VISIBLE_CLUSTER_CARDS);
      const maxCardStart = Math.max(0, clusterJobs.length - visibleCardCount);
      const cardStart = Math.min(clusterCardStarts[clusterId] ?? 0, maxCardStart);
      const visibleJobs = clusterJobs.slice(cardStart, cardStart + visibleCardCount);
      const cardWidth = visibleCardCount === 1
        ? "min(16.4rem, 76vw)"
        : visibleCardCount === 2
          ? "min(14rem, calc((100vw - 2.5rem) / 2))"
          : "min(11.5rem, calc((100vw - 3rem) / 3))";
      const markerElement = document.createElement("div");
      markerElement.className = `job-map-marker${isExpanded ? " is-expanded" : ""}${clusterJobs.length > 1 ? " is-cluster" : ""}`;
      markerElement.dataset.clusterId = clusterId;
      markerElement.style.setProperty("--job-map-card-width", cardWidth);
      markerElement.innerHTML = `
        <section class="job-map-cluster-cards" aria-hidden="${!isExpanded}">
          <button type="button" class="job-map-close" aria-label="Stäng jobbannonserna">×</button>
          ${cardStart > 0 ? '<button type="button" class="job-map-cluster-arrow job-map-cluster-previous" aria-label="Visa tidigare annonser">‹</button>' : ""}
          <div class="job-map-card-list">
            ${visibleJobs.map(({ job, coordinates: jobCoordinates }) => `
              <article class="job-map-card">
                <p class="job-map-company">${escapeHtml(job.company_name || "Företag")}</p>
                <h2>${escapeHtml(job.title)}</h2>
                <div class="job-map-meta">
                  <span>${escapeHtml(job.salary_per_hour || "Lön enligt överenskommelse")}</span>
                  ${distanceBetween(userCoordinates, jobCoordinates) ? `<span>${distanceBetween(userCoordinates, jobCoordinates)}</span>` : ""}
                </div>
                <button type="button" class="job-map-cta" data-job-id="${escapeHtml(job.id)}">Visa jobbet <span aria-hidden="true">→</span></button>
              </article>
            `).join("")}
          </div>
          ${cardStart < maxCardStart ? '<button type="button" class="job-map-cluster-arrow job-map-cluster-next" aria-label="Visa fler annonser">›</button>' : ""}
        </section>
        <button type="button" class="job-map-pin" aria-label="${clusterJobs.length > 1 ? `${clusterJobs.length} jobbannonser på samma plats` : `${escapeHtml(clusterJobs[0].job.title)}, ${escapeHtml(clusterJobs[0].job.company_name || "Företag")}`}" aria-expanded="${isExpanded}">
          <span aria-hidden="true">${clusterJobs.length > 1 ? clusterJobs.length : "⌖"}</span>
        </button>
      `;

      const toggle = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        setActiveClusterId((current) => current === clusterId ? null : clusterId);
      };
      markerElement.querySelector(".job-map-pin")?.addEventListener("click", toggle);
      markerElement.querySelector(".job-map-close")?.addEventListener("click", toggle);
      markerElement.querySelector(".job-map-cluster-previous")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setClusterCardStarts((current) => ({ ...current, [clusterId]: Math.max(0, cardStart - 1) }));
      });
      markerElement.querySelector(".job-map-cluster-next")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        setClusterCardStarts((current) => ({ ...current, [clusterId]: Math.min(maxCardStart, cardStart + 1) }));
      });
      markerElement.querySelectorAll<HTMLButtonElement>(".job-map-cta").forEach((button) => button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        router.push(`/jobb/${encodeURIComponent(button.dataset.jobId || "")}`);
      }));

      return new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([coordinates.longitude, coordinates.latitude])
        .addTo(map);
    });

    if (!activeClusterId && jobClusters.length) {
      if (jobClusters.length === 1) {
        const location = jobClusters[0].coordinates;
        map.easeTo({ center: [location.longitude, location.latitude], zoom: 11, duration: 350 });
      } else {
        const bounds = new mapboxgl.LngLatBounds();
        jobClusters.forEach(({ coordinates }) => bounds.extend([coordinates.longitude, coordinates.latitude]));
        map.fitBounds(bounds, { padding: { top: 110, right: 80, bottom: 130, left: 80 }, maxZoom: 11, duration: 0 });
      }
    }
  }, [activeClusterId, clusterCardStarts, jobClusters, mapReady, router, userCoordinates]);

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
