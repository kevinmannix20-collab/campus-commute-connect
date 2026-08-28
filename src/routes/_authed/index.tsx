import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import campusMap from "@/assets/campus-map.jpg";
import { PhoneShell } from "@/components/PhoneShell";

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

function RequestScreen() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState("");
  const [time, setTime] = useState("22:45");
  const [mode, setMode] = useState<"bus" | "car">("bus");
  const [searching, setSearching] = useState(false);

  return (
    <PhoneShell active="home">
      <header className="p-6 pb-4">
        <h1 className="text-balance font-serif text-2xl font-medium leading-tight text-forest">
          Where are you headed tonight?
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto px-6">
        <div className="space-y-4">
          <div>
            <label className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              Starting Point
            </label>
            <div className="flex w-full items-center gap-3 rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <div className="size-2 rounded-full bg-forest" />
              <span className="text-sm text-zinc-900">Main Campus Library</span>
            </div>
          </div>

          <div>
            <label
              htmlFor="destination"
              className="mb-1 ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
            >
              Destination
            </label>
            <div className="flex w-full items-center gap-3 rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
              <div className="size-2 rounded-full border border-forest" />
              <input
                id="destination"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Enter destination..."
                className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="time"
                className="ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500"
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
            <div className="space-y-1">
              <span className="ml-1 block text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Mode
              </span>
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
          </div>
        </div>

        <div className="relative h-48 overflow-hidden rounded-[12px] bg-zinc-100 ring-1 ring-black/5">
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
            {searching
              ? "Searching for a match — we'll notify you"
              : "Matching you with nearby companions..."}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setSearching(true);
            setTimeout(() => navigate({ to: "/trips" }), 900);
          }}
          className="w-full rounded-[16px] bg-forest py-3 text-sm font-medium text-sand ring-2 ring-forest ring-offset-2 transition-transform active:scale-[0.98]"
        >
          {searching ? "Looking for a mate…" : "Find a Travel Mate"}
        </button>
      </div>
    </PhoneShell>
  );
}
