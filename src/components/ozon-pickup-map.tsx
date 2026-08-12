"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type {
  OzonMapViewport,
  PublicOzonCluster,
  PublicOzonPoint,
} from "@/lib/ozon-delivery";

export interface MapTarget {
  lat: number;
  long: number;
  zoom: number;
}

export interface MapView extends MapTarget {
  viewport: OzonMapViewport;
}

interface OzonPickupMapProps {
  target: MapTarget;
  points: PublicOzonPoint[];
  clusters: PublicOzonCluster[];
  selectedPointId?: number;
  onViewChange: (view: MapView) => void;
  onSelect: (point: PublicOzonPoint) => void;
}

function markerIcon(selected: boolean) {
  return L.divIcon({
    className: "momo-map-marker-wrap",
    html: `<span class="momo-map-marker${selected ? " is-selected" : ""}" aria-hidden="true"><span>OZON</span></span>`,
    iconSize: selected ? [42, 42] : [34, 34],
    iconAnchor: selected ? [21, 42] : [17, 34],
    popupAnchor: [0, -32],
  });
}

function clusterIcon(pointsCount: number) {
  const label = pointsCount > 999 ? "999+" : String(pointsCount);
  const size = pointsCount > 99 ? 58 : pointsCount > 9 ? 52 : 46;
  return L.divIcon({
    className: "momo-map-cluster-wrap",
    html: `<span class="momo-map-cluster" aria-hidden="true"><b>${label}</b><small>OZON</small></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function pointWord(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return "пунктов";
  if (last === 1) return "пункт";
  if (last >= 2 && last <= 4) return "пункта";
  return "пунктов";
}

function popupContent(point: PublicOzonPoint, onSelect: () => void) {
  const root = document.createElement("div");
  root.className = "momo-map-popup";

  const title = document.createElement("b");
  title.textContent = point.name;
  root.append(title);

  const address = document.createElement("span");
  address.textContent = point.address;
  root.append(address);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Выбрать этот ПВЗ";
  button.addEventListener("click", onSelect);
  root.append(button);

  return root;
}

function currentView(map: L.Map): MapView {
  const center = map.getCenter();
  const bounds = map.getBounds();
  return {
    lat: center.lat,
    long: center.lng,
    zoom: map.getZoom(),
    viewport: {
      south: bounds.getSouth(),
      west: bounds.getWest(),
      north: bounds.getNorth(),
      east: bounds.getEast(),
    },
  };
}

export function OzonPickupMap({
  target,
  points,
  clusters,
  selectedPointId,
  onViewChange,
  onSelect,
}: OzonPickupMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const viewHandlerRef = useRef(onViewChange);
  const selectHandlerRef = useRef(onSelect);

  useEffect(() => {
    viewHandlerRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    selectHandlerRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [target.lat, target.long],
      zoom: target.zoom,
      minZoom: 2,
      maxZoom: 19,
      scrollWheelZoom: true,
      worldCopyJump: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    const reportView = () => viewHandlerRef.current(currentView(map));
    map.on("moveend", reportView);
    map.whenReady(reportView);
    mapRef.current = map;
    markersRef.current = markers;

    return () => {
      map.off("moveend", reportView);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
    // Карта создаётся один раз; новые цели применяет эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const next = L.latLng(target.lat, target.long);
    const centerChanged = map.getCenter().distanceTo(next) > 40;
    const zoomChanged = Math.abs(map.getZoom() - target.zoom) >= 1;
    if (centerChanged || zoomChanged) {
      map.setView(next, target.zoom, { animate: true });
    }
  }, [target.lat, target.long, target.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();

    for (const cluster of clusters) {
      const marker = L.marker([cluster.lat, cluster.long], {
        icon: clusterIcon(cluster.pointsCount),
        keyboard: true,
        title: `${cluster.pointsCount} ${pointWord(cluster.pointsCount)} Ozon`,
      });
      marker.on("click", () => {
        const { south, west, north, east } = cluster.viewport;
        const bounds = L.latLngBounds([south, west], [north, east]);
        if (bounds.isValid() && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 80) {
          map.fitBounds(bounds, { padding: [48, 48], maxZoom: 18, animate: true });
        } else {
          map.setView([cluster.lat, cluster.long], Math.min(19, map.getZoom() + 2), {
            animate: true,
          });
        }
      });
      marker.addTo(markers);
    }

    for (const point of points) {
      const selected = point.id === selectedPointId;
      const choose = () => selectHandlerRef.current(point);
      const marker = L.marker([point.lat, point.long], {
        icon: markerIcon(selected),
        zIndexOffset: selected ? 1000 : 0,
        keyboard: true,
        title: point.address,
      });
      marker.on("click", choose);
      marker.bindPopup(popupContent(point, choose), { minWidth: 220 });
      marker.addTo(markers);
    }
  }, [clusters, points, selectedPointId]);

  return (
    <div
      ref={containerRef}
      className="h-[390px] w-full sm:h-[500px]"
      role="application"
      aria-label="Карта пунктов выдачи Ozon по России"
    />
  );
}
