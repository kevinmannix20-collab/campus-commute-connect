import { useEffect, useState } from "react";

import { useGoogleMapsLoaded } from "./use-google-maps";

export type TravelDurations = { car: string | null; bus: string | null };

const EMPTY: TravelDurations = { car: null, bus: null };

type LatLng = { lat: number; lng: number };

// Fetches driving + transit duration together (one Distance Matrix call
// each) as soon as both points are known, so toggling Bus/Car afterward is
// instant — no new request per toggle. Resolves to null per-mode (not an
// error) when a route can't be found, so the caller can just hide that
// mode's time rather than show a broken state.
export function useTravelDurations(
  pickup: LatLng | null,
  destination: LatLng | null,
): TravelDurations {
  const mapsLoaded = useGoogleMapsLoaded();
  const [durations, setDurations] = useState<TravelDurations>(EMPTY);

  useEffect(() => {
    if (!mapsLoaded || !pickup || !destination) {
      setDurations(EMPTY);
      return;
    }

    let cancelled = false;
    const service = new google.maps.DistanceMatrixService();

    const fetchOne = (travelMode: google.maps.TravelMode) =>
      new Promise<string | null>((resolve) => {
        service.getDistanceMatrix(
          { origins: [pickup], destinations: [destination], travelMode },
          (response, status) => {
            const element = response?.rows[0]?.elements[0];
            resolve(
              status === "OK" && element?.status === "OK" ? (element.duration?.text ?? null) : null,
            );
          },
        );
      });

    Promise.all([
      fetchOne(google.maps.TravelMode.DRIVING),
      fetchOne(google.maps.TravelMode.TRANSIT),
    ]).then(([car, bus]) => {
      if (!cancelled) setDurations({ car, bus });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- compare by value, not object identity (pickup/destination are recomputed every render)
  }, [mapsLoaded, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  return durations;
}
