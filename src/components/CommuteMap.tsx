import { useEffect, useRef } from "react";

import { useGoogleMapsLoaded } from "@/lib/use-google-maps";

type LatLng = { lat: number; lng: number };

type Props = {
  pickup: LatLng | null;
  destination: LatLng | null;
};

// Default center when nothing is set yet — UCLA Anderson.
const FALLBACK_CENTER: LatLng = { lat: 34.0736, lng: -118.4431 };

export function CommuteMap({ pickup, destination }: Props) {
  const mapsLoaded = useGoogleMapsLoaded();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!mapsLoaded || !containerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: pickup ?? destination ?? FALLBACK_CENTER,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,

      gestureHandling: "cooperative",
    });
    // Only ever run once, on the first frame the map has a container to mount into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapsLoaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    pickupMarkerRef.current?.setMap(null);
    destinationMarkerRef.current?.setMap(null);
    lineRef.current?.setMap(null);

    if (pickup) {
      pickupMarkerRef.current = new google.maps.Marker({
        map,
        position: pickup,
        label: { text: "P", color: "#fdfcfb", fontSize: "11px", fontWeight: "600" },
        title: "Pickup",
      });
    }

    if (destination) {
      destinationMarkerRef.current = new google.maps.Marker({
        map,
        position: destination,
        label: { text: "D", color: "#fdfcfb", fontSize: "11px", fontWeight: "600" },
        title: "Destination",
      });
    }

    if (pickup && destination) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pickup);
      bounds.extend(destination);
      map.fitBounds(bounds, 48);

      lineRef.current = new google.maps.Polyline({
        map,
        path: [pickup, destination],
        strokeColor: "#1a2f23",
        strokeOpacity: 0.5,
        strokeWeight: 2,
      });
    } else if (pickup) {
      map.setCenter(pickup);
      map.setZoom(14);
    } else if (destination) {
      map.setCenter(destination);
      map.setZoom(14);
    }
  }, [pickup, destination]);

  if (!mapsLoaded) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Map showing pickup and destination"
      className="h-48 w-full overflow-hidden rounded-[12px] ring-1 ring-black/5"
    />
  );
}
