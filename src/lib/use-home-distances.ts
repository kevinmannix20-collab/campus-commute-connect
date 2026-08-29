import { useEffect, useState } from "react";

import { useGoogleMapsLoaded } from "./use-google-maps";

type LatLng = { lat: number; lng: number };
type Destination = { id: string; lat: number | null; lng: number | null };

// Maps a posting id to its driving time from home, e.g. "12 min". Missing
// when the destination has no stored coordinates or no route was found.
export type HomeDistances = Record<string, string>;

// One Distance Matrix call for the whole feed (single origin, many
// destinations) instead of one call per card — Google bills/rate-limits
// per request, and the feed can easily have a dozen open postings.
export function useHomeDistances(home: LatLng | null, destinations: Destination[]): HomeDistances {
  const mapsLoaded = useGoogleMapsLoaded();
  const [distances, setDistances] = useState<HomeDistances>({});

  const withCoords = destinations.filter(
    (d): d is Destination & { lat: number; lng: number } => d.lat != null && d.lng != null,
  );
  const key = withCoords.map((d) => `${d.id}:${d.lat},${d.lng}`).join("|");

  useEffect(() => {
    if (!mapsLoaded || !home || withCoords.length === 0) {
      setDistances({});
      return;
    }

    let cancelled = false;
    const service = new google.maps.DistanceMatrixService();

    service.getDistanceMatrix(
      {
        origins: [home],
        destinations: withCoords.map((d) => ({ lat: d.lat, lng: d.lng })),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (cancelled || status !== "OK" || !response) return;
        const elements = response.rows[0]?.elements ?? [];
        const next: HomeDistances = {};
        withCoords.forEach((d, i) => {
          const element = elements[i];
          if (element?.status === "OK" && element.duration) {
            next[d.id] = element.duration.text;
          }
        });
        setDistances(next);
      },
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` already encodes every destination id/lat/lng; home compared by value below
  }, [mapsLoaded, home?.lat, home?.lng, key]);

  return distances;
}
