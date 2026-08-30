import { useMutation } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { CommuteMap } from "@/components/CommuteMap";
import { CompanionTagger, type TaggedCompanion } from "@/components/CompanionTagger";
import { PhoneShell } from "@/components/PhoneShell";
import { PlaceAutocompleteInput, type ResolvedPlace } from "@/components/PlaceAutocompleteInput";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useGoogleMapsLoaded } from "@/lib/use-google-maps";
import { useTravelDurations } from "@/lib/use-travel-durations";
import { combineDateAndTime, todayLocalDateString } from "@/lib/trip-time";
import { estimateGasGallons, haversineDistanceMiles } from "@/lib/carbonSavings";

export const Route = createFileRoute("/_authed/")({
  head: () => ({
    meta: [
      { title: "Commute Mate — Find a travel mate to campus" },
      {
        name: "description",
        content:
          "Request a bus companion or a car seat for your commute to and from campus, and get matched with students heading your way.",
      },
      { property: "og:title", content: "Commute Mate — Find a travel mate to campus" },
      {
        property: "og:description",
        content:
          "Request a bus companion or a car seat for your commute and get matched with students heading your way.",
      },
    ],
  }),
  component: RequestScreen,
});

const DEFAULT_STARTING_POINT = "UCLA Anderson School of Management";
// Matches CommuteMap's own FALLBACK_CENTER — keeping the default starting
// point's coordinates in sync with its address text so the map opens
// already centered on campus instead of blank until a place is picked.
const DEFAULT_STARTING_POINT_COORDS = { lat: 34.0736, lng: -118.4431 };

type LocationField = { address: string; lat: number | null; lng: number | null };

function RequestScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const mapsLoaded = useGoogleMapsLoaded();
  const [pickup, setPickup] = useState<LocationField>({
    address: DEFAULT_STARTING_POINT,
    lat: DEFAULT_STARTING_POINT_COORDS.lat,
    lng: DEFAULT_STARTING_POINT_COORDS.lng,
  });
  const [destination, setDestination] = useState<LocationField>({
    address: "",
    lat: null,
    lng: null,
  });
  const [date, setDate] = useState(todayLocalDateString());
  const [time, setTime] = useState("22:45");
  const [mode, setMode] = useState<"bus" | "car">("bus");
  const [postType, setPostType] = useState<"need" | "offer">("need");
  const [companions, setCompanions] = useState<TaggedCompanion[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const submitRequest = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { data: request, error } = await supabase
        .from("trip_requests")
        .insert({
          user_id: user.id,
          starting_point: pickup.address,
          starting_point_lat: pickup.lat,
          starting_point_lng: pickup.lng,
          destination: destination.address,
          destination_lat: destination.lat,
          destination_lng: destination.lng,
          requested_time: combineDateAndTime(date, time).toISOString(),
          mode,
          post_type: postType,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (mode === "car" && companions.length > 0) {
        const { error: companionsError } = await supabase.from("trip_request_companions").insert(
          companions.map((companion) => ({
            trip_request_id: request.id,
            user_id: companion.id,
            added_by: user.id,
          })),
        );
        if (companionsError) throw companionsError;
      }
    },
    onSuccess: () => {
      navigate({ to: "/trips" });
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Something went wrong");
    },
  });

  const handleSubmit = () => {
    setFormError(null);
    if (!destination.address.trim()) {
      setFormError("Enter a destination first");
      return;
    }
    submitRequest.mutate();
  };

  const handlePlaceSelected =
    (setter: (field: LocationField) => void) => (place: ResolvedPlace) => {
      setter(place);
    };

  const handleUseCurrentLocation = () => {
    setFormError(null);
    if (!("geolocation" in navigator)) {
      setFormError(
        "Your browser doesn't support location access — please enter your address manually.",
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          setLocating(false);
          const address =
            status === "OK" && results?.[0]
              ? results[0].formatted_address
              : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
          setPickup({ address, lat: latitude, lng: longitude });
        });
      },
      (error) => {
        setLocating(false);
        setFormError(
          error.code === error.PERMISSION_DENIED
            ? "Location access denied — please enter your address manually."
            : "Couldn't determine your location — please enter your address manually.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  // Memoized so CommuteMap/useTravelDurations only see a new object when
  // the coordinates actually change — otherwise every unrelated re-render
  // (e.g. the travel-time fetch resolving) hands them a fresh object with
  // identical values, and effects keyed on these by reference re-run for
  // no reason, fighting the map's own height-transition timing.
  const pickupCoords = useMemo(
    () =>
      pickup.lat !== null && pickup.lng !== null ? { lat: pickup.lat, lng: pickup.lng } : null,
    [pickup.lat, pickup.lng],
  );
  const destinationCoords = useMemo(
    () =>
      destination.lat !== null && destination.lng !== null
        ? { lat: destination.lat, lng: destination.lng }
        : null,
    [destination.lat, destination.lng],
  );

  const travelDurations = useTravelDurations(pickupCoords, destinationCoords);
  const travelTime = mode === "car" ? travelDurations.car : travelDurations.bus;
  const travelTimeLabel = travelTime ? `~${travelTime} by ${mode}` : null;

  // A single-line fun fact shown only while the request is submitting —
  // lightweight context on the trip's footprint, not a blocking screen.
  const gasFunFact =
    pickupCoords && destinationCoords
      ? `Did you know? This commute would use about ${estimateGasGallons(haversineDistanceMiles(pickupCoords, destinationCoords)).toFixed(1)} gallons of gas alone — nice work sharing the ride.`
      : null;

  return (
    <PhoneShell active="home">
      <header className="p-6 pb-4">
        <h1 className="mr-20 text-balance font-serif text-2xl font-medium leading-tight text-forest">
          Where are you headed?
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <span className="ml-1 block text-[11px] font-medium tracking-wider text-zinc-500">
              I&apos;m posting to
            </span>
            <div className="flex rounded-[12px] bg-zinc-100 p-1 ring-1 ring-zinc-200">
              <button
                type="button"
                onClick={() => setPostType("need")}
                className={
                  postType === "need"
                    ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                    : "flex-1 py-2 text-xs font-medium text-zinc-500"
                }
              >
                I need a ride/buddy
              </button>
              <button
                type="button"
                onClick={() => setPostType("offer")}
                className={
                  postType === "offer"
                    ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                    : "flex-1 py-2 text-xs font-medium text-zinc-500"
                }
              >
                I&apos;m offering a ride/company
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 ml-1 flex items-center justify-between">
              <label
                htmlFor="starting-point"
                className="block text-[11px] font-medium tracking-wider text-zinc-500"
              >
                Starting Point
              </label>
              {mapsLoaded ? (
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={locating}
                  className="text-[10px] font-medium text-forest underline underline-offset-2 disabled:opacity-50"
                >
                  {locating ? "Locating…" : "Use current location"}
                </button>
              ) : null}
            </div>
            <div className="flex w-full items-center gap-3 rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <div className="size-2 rounded-full bg-forest" />
              <PlaceAutocompleteInput
                id="starting-point"
                value={pickup.address}
                onTextChange={(text) => setPickup({ address: text, lat: null, lng: null })}
                onPlaceSelected={handlePlaceSelected(setPickup)}
                placeholder="Enter starting point..."
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="destination"
              className="mb-1 ml-1 block text-[11px] font-medium tracking-wider text-zinc-500"
            >
              Destination
            </label>
            <div className="flex w-full items-center gap-3 rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <div className="size-2 rounded-full border border-forest" />
              <PlaceAutocompleteInput
                id="destination"
                value={destination.address}
                onTextChange={(text) => setDestination({ address: text, lat: null, lng: null })}
                onPlaceSelected={handlePlaceSelected(setDestination)}
                placeholder="Enter destination..."
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="date"
                className="ml-1 block text-[11px] font-medium tracking-wider text-zinc-500"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                min={todayLocalDateString()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="time"
                className="ml-1 block text-[11px] font-medium tracking-wider text-zinc-500"
              >
                Time
              </label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-[12px] bg-zinc-50 px-4 py-3 text-sm text-zinc-900 outline-none ring-1 ring-zinc-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="ml-1 flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wider text-zinc-500">Mode</span>
              {travelTimeLabel ? (
                <span className="text-[11px] font-medium text-forest">{travelTimeLabel}</span>
              ) : null}
            </div>
            <div className="flex rounded-[12px] bg-zinc-100 p-1 ring-1 ring-zinc-200">
              <button
                type="button"
                onClick={() => setMode("bus")}
                className={
                  mode === "bus"
                    ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                    : "flex-1 py-2 text-xs font-medium text-zinc-500"
                }
              >
                Bus
              </button>
              <button
                type="button"
                onClick={() => setMode("car")}
                className={
                  mode === "car"
                    ? "flex-1 rounded-[8px] bg-sand py-2 text-xs font-medium text-forest shadow-sm"
                    : "flex-1 py-2 text-xs font-medium text-zinc-500"
                }
              >
                Car
              </button>
            </div>
          </div>

          {mode === "car" ? (
            <div className="space-y-1">
              <span className="ml-1 block text-[11px] font-medium tracking-wider text-zinc-500">
                Riding With (optional)
              </span>
              <CompanionTagger selected={companions} onChange={setCompanions} />
            </div>
          ) : null}
        </div>

        <CommuteMap pickup={pickupCoords} destination={destinationCoords} />
      </div>

      <div className="border-t border-zinc-950/5 bg-sand p-6">
        <div className="mb-4 flex items-center gap-3 text-xs text-zinc-500">
          <span
            className={
              mode === "bus"
                ? "size-1.5 animate-pulse rounded-full bg-transit-bus"
                : "size-1.5 animate-pulse rounded-full bg-transit-car"
            }
          />
          <span>
            {formError
              ? formError
              : submitRequest.isPending
                ? (gasFunFact ?? "Posting your request…")
                : postType === "offer"
                  ? "Post your offer and we'll look for a match"
                  : "Post a request and we'll look for a match"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitRequest.isPending}
          className="w-full rounded-[16px] bg-forest py-3 text-sm font-medium text-sand ring-2 ring-forest ring-offset-2 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {submitRequest.isPending
            ? "Looking for a mate…"
            : postType === "offer"
              ? "Post My Offer"
              : "Find a Travel Mate"}
        </button>
      </div>
    </PhoneShell>
  );
}
