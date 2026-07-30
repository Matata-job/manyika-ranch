"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocateFixed } from "lucide-react";
import { useT } from "@/components/providers/locale-provider";

/** Default: Singida, Tanzania */
const DEFAULT_CENTER: [number, number] = [-4.8167, 34.75];

interface CampLocationPickerProps {
  latitude: string;
  longitude: string;
  onChange: (coords: { latitude: string; longitude: string }) => void;
  disabled?: boolean;
}

export function CampLocationPicker({
  latitude,
  longitude,
  onChange,
  disabled = false,
}: CampLocationPickerProps) {
  const t = useT();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").Marker | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (!online || !mapRef.current || mapInstance.current) return;
    let cancelled = false;

    async function init() {
      const L = (await import("leaflet")).default;
      // @ts-expect-error leaflet CSS side-effect import
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !mapRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const lat = latitude ? parseFloat(latitude) : DEFAULT_CENTER[0];
      const lng = longitude ? parseFloat(longitude) : DEFAULT_CENTER[1];
      const start: [number, number] = [
        Number.isFinite(lat) ? lat : DEFAULT_CENTER[0],
        Number.isFinite(lng) ? lng : DEFAULT_CENTER[1],
      ];

      const map = L.map(mapRef.current, {
        center: start,
        zoom: latitude && longitude ? 13 : 8,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(start, { draggable: !disabled }).addTo(map);
      markerRef.current = marker;
      mapInstance.current = map;

      function setFromLatLng(ll: { lat: number; lng: number }) {
        onChange({
          latitude: ll.lat.toFixed(6),
          longitude: ll.lng.toFixed(6),
        });
      }

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setFromLatLng(pos);
      });

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        if (disabled) return;
        marker.setLatLng(e.latlng);
        setFromLatLng(e.latlng);
      });

      setTimeout(() => map.invalidateSize(), 100);
    }

    init();

    return () => {
      cancelled = true;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
        markerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount when online again
  }, [online]);

  useEffect(() => {
    const map = mapInstance.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const current = marker.getLatLng();
    if (
      Math.abs(current.lat - lat) < 0.00001 &&
      Math.abs(current.lng - lng) < 0.00001
    ) {
      return;
    }
    marker.setLatLng([lat, lng]);
    map.panTo([lat, lng]);
  }, [latitude, longitude]);

  function useMyLocation() {
    if (!navigator.geolocation) {
      alert(t("geolocationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
      },
      () => alert(t("geolocationFailed")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{t("campLocation")}</Label>
        {!disabled && (
          <Button type="button" size="sm" variant="outline" onClick={useMyLocation}>
            <LocateFixed className="h-4 w-4 mr-1" />
            {t("useMyLocation")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t("campLocationHelp")}</p>
      {online ? (
        <div
          ref={mapRef}
          className="h-64 w-full rounded-lg border z-0"
          aria-label={t("campLocation")}
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border bg-muted/40 px-4 text-center text-sm text-muted-foreground">
          {t("mapUnavailableOffline")}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="latitude">{t("latitude")}</Label>
          <Input
            id="latitude"
            value={latitude}
            disabled={disabled}
            onChange={(e) =>
              onChange({ latitude: e.target.value, longitude })
            }
            placeholder="-4.816700"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="longitude">{t("longitude")}</Label>
          <Input
            id="longitude"
            value={longitude}
            disabled={disabled}
            onChange={(e) =>
              onChange({ latitude, longitude: e.target.value })
            }
            placeholder="34.750000"
          />
        </div>
      </div>
    </div>
  );
}
