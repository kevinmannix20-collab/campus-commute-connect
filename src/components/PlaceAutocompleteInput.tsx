import { useEffect, useRef } from "react";

import { useGoogleMapsLoaded } from "@/lib/use-google-maps";

export type ResolvedPlace = { address: string; lat: number; lng: number };

type Props = {
  id?: string;
  value: string;
  onTextChange: (text: string) => void;
  onPlaceSelected: (place: ResolvedPlace) => void;
  placeholder?: string;
  className?: string;
};

// A plain <input> that upgrades itself into a Google Places Autocomplete
// field once the Maps script has loaded. If it never loads (no API key, or
// the script failed), this silently stays a plain text input — the caller
// just won't get lat/lng, same as if the user typed without picking a
// suggestion.
export function PlaceAutocompleteInput({
  id,
  value,
  onTextChange,
  onPlaceSelected,
  placeholder,
  className,
}: Props) {
  const mapsLoaded = useGoogleMapsLoaded();
  const inputRef = useRef<HTMLInputElement>(null);
  const onPlaceSelectedRef = useRef(onPlaceSelected);
  onPlaceSelectedRef.current = onPlaceSelected;

  useEffect(() => {
    const inputEl = inputRef.current;
    if (!mapsLoaded || !inputEl) return;

    const autocomplete = new google.maps.places.Autocomplete(inputEl, {
      fields: ["formatted_address", "geometry"],
    });

    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return;
      onPlaceSelectedRef.current({
        address: place.formatted_address ?? inputEl.value,
        lat: location.lat(),
        lng: location.lng(),
      });
    });

    return () => {
      google.maps.event.removeListener(listener);
      google.maps.event.clearInstanceListeners(inputEl);
    };
  }, [mapsLoaded]);

  return (
    <input
      id={id}
      ref={inputRef}
      value={value}
      onChange={(e) => onTextChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      className={className}
    />
  );
}
