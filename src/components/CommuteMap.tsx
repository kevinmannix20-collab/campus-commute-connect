import { useEffect, useRef } from "react";

import campusMap from "@/assets/campus-map.jpg";
import { useGoogleMapsLoaded } from "@/lib/use-google-maps";

type LatLng = { lat: number; lng: number };

type Props = {
  pickup: LatLng | null;
  destination: LatLng | null;
};

// Default center when nothing is set yet — UCLA Anderson.
const FALLBACK_CENTER: LatLng = { lat: 34.0736, lng: -118.4431 };

const COMPACT_HEIGHT_PX = 160;
const EXPANDED_HEIGHT_PX = 288;

// Light-touch styling only — hide POI/transit icon clutter that reads busy
// at this small size. Not a re-theme: road/water colors stay default so the
// map still looks like a map, just tidier.
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

export function CommuteMap({ pickup, destination }: Props) {
  const mapsLoaded = useGoogleMapsLoaded();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destinationMarkerRef = useRef<google.maps.Marker | null>(null);
  const lineRef = useRef<google.maps.Polyline | null>(null);
  // Mirrors pickup/destination for the transitionend handler below, which
  // is set up once and can't close over fresh props on every render.
  const pointsRef = useRef({ pickup, destination });
  pointsRef.current = { pickup, destination };

  const showRealMap = mapsLoaded && (pickup !== null || destination !== null);
  const isExpanded = pickup !== null && destination !== null;

  useEffect(() => {
    // Container only exists once showRealMap is true, so this can't create
    // the map until then — that's intentional, not just a guard.
    if (!showRealMap || !containerRef.current || mapRef.current) return;
    mapRef.current = new google.maps.Map(containerRef.current, {
      center: pickup ?? destination ?? FALLBACK_CENTER,
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "cooperative",
      styles: MAP_STYLE,
    });
    // Only ever run once, on the first frame the map has a container to mount into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRealMap]);

  // Reframes the map on whatever pickup/destination currently are. Called
  // both directly (when the points themselves change) and once more from
  // the transitionend handler below (when the container's animated height
  // finishes changing the available space) — cheap and idempotent, so
  // overlap between the two triggers is harmless.
  const reframe = () => {
    const map = mapRef.current;
    const { pickup: p, destination: d } = pointsRef.current;
    if (!map) return;

    if (p && d) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(p);
      bounds.extend(d);
      map.fitBounds(bounds, 48);
    } else if (p) {
      map.setCenter(p);
      map.setZoom(14);
    } else if (d) {
      map.setCenter(d);
      map.setZoom(14);
    }
  };

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
        label: { text: "P", color: "#ffffff", fontSize: "11px", fontWeight: "600" },
        title: "Pickup",
      });
    }

    if (destination) {
      destinationMarkerRef.current = new google.maps.Marker({
        map,
        position: destination,
        label: { text: "D", color: "#ffffff", fontSize: "11px", fontWeight: "600" },
        title: "Destination",
      });
    }

    if (pickup && destination) {
      lineRef.current = new google.maps.Polyline({
        map,
        path: [pickup, destination],
        strokeColor: "#2774ae",
        strokeOpacity: 0.5,
        strokeWeight: 2,
      });
    }

    reframe();

    // The wrapper's height animates via a CSS transition (compact <->
    // expanded), and Google Maps doesn't notice that resize on its own —
    // the direct reframe() call above (mid-transition) frames against the
    // pre-transition size. One more reframe just past the 500ms transition
    // corrects it. (A ResizeObserver and transitionend were tried here
    // first — the observer's own resize trigger fed back into itself
    // indefinitely, and transitionend never fired at all; not worth
    // blocking on decoding why. This is deliberately dumb and just works.)
    const timeout = setTimeout(reframe, 550);
    return () => clearTimeout(timeout);
  }, [pickup, destination]);

  return (
    <div
      ref={wrapperRef}
      className="overflow-hidden rounded-[16px] ring-1 ring-black/5 transition-[height] duration-500 ease-in-out"
      style={{ height: isExpanded ? EXPANDED_HEIGHT_PX : COMPACT_HEIGHT_PX }}
    >
      {showRealMap ? (
        <div
          ref={containerRef}
          role="img"
          aria-label="Map showing pickup and destination"
          className="size-full"
        />
      ) : (
        <div className="relative size-full bg-zinc-100">
          <img
            src={campusMap}
            alt="Campus map at night with a highlighted route"
            width={800}
            height={512}
            className="size-full object-cover opacity-40"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-searching size-12 rounded-full bg-forest/10" />
            <div className="size-3 rounded-full bg-forest" />
          </div>
        </div>
      )}
    </div>
  );
}
