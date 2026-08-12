"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicOzonPoint } from "@/lib/ozon-delivery";

export interface MapCenter {
  lat: number;
  long: number;
}

interface OzonPickupMapProps {
  center: MapCenter;
  points: PublicOzonPoint[];
  selectedPointId?: number;
  onCenterChange: (center: MapCenter) => void;
  onSelect: (point: PublicOzonPoint) => void;
}

function markerIcon(selected: boolean) {
  return L.divIcon({
    className: "momo-map-marker-wrap",
    html: `<span class="momo-map-marker${selected ? " is-selected" : ""}" aria-hidden="true"><span>O</span></span>`,
    iconSize: selected ? [42, 42] : [34, 34],
    iconAnchor: selected ? [21, 42] : [17, 34],
    popupAnchor: [0, -32],
  });
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

export function OzonPickupMap({
  center,
  points,
  selectedPointId,
  onCenterChange,
  onSelect,
}: OzonPickupMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const centerHandlerRef = useRef(onCenterChange);
  const selectHandlerRef = useRef(onSelect);

  useEffect(() => {
    centerHandlerRef.current = onCenterChange;
  }, [onCenterChange]);

  useEffect(() => {
    selectHandlerRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [center.lat, center.long],
      zoom: 11,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    const markers = L.layerGroup().addTo(map);
    const reportCenter = () => {
      const next = map.getCenter();
      centerHandlerRef.current({ lat: next.lat, long: next.lng });
    };
    map.on("moveend", reportCenter);
    mapRef.current = map;
    markersRef.current = markers;

    return () => {
      map.off("moveend", reportCenter);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
    };
    // Карта создаётся один раз; последующие координаты применяет эффект ниже.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = L.latLng(center.lat, center.long);
    if (map.getCenter().distanceTo(target) > 20) {
      map.setView(target, Math.max(map.getZoom(), 11), { animate: true });
    }
  }, [center.lat, center.long]);

  useEffect(() => {
    const map = mapRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;
    markers.clearLayers();

    for (const point of points) {
      const selected = point.id === selectedPointId;
      const choose = () => selectHandlerRef.current(point);
      const marker = L.marker([point.lat, point.long], {
        icon: markerIcon(selected),
        zIndexOffset: selected ? 1000 : 0,
      });
      marker.on("click", choose);
      marker.bindPopup(popupContent(point, choose), { minWidth: 220 });
      marker.addTo(markers);
    }

    if (points.length) {
      const bounds = L.latLngBounds(points.map((point) => [point.lat, point.long]));
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 14, animate: true });
    }
  }, [points, selectedPointId]);

  return (
    <div
      ref={containerRef}
      className="h-[360px] w-full sm:h-[440px]"
      role="application"
      aria-label="Карта пунктов выдачи Ozon"
    />
  );
}
