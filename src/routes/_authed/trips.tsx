import { createFileRoute } from "@tanstack/react-router";

import marcus from "@/assets/student-marcus.jpg";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/_authed/trips")({
  head: () => ({
    meta: [
      { title: "Your Journey — Commute Mate" },
      {
        name: "description",
        content:
          "Track the status of your commute requests and view the itinerary for every matched bus companion or car ride.",
      },
      { property: "og:title", content: "Your Journey — Commute Mate" },
      {
        property: "og:description",
        content:
          "Track your commute requests and view the itinerary for every matched ride or bus companion.",
      },
    ],
  }),
  component: StatusScreen,
});

function StatusScreen() {
  return (
    <PhoneShell active="status">
      <header className="p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">
          Your Journey
        </h1>
      </header>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        <div className="space-y-4 rounded-[20px] bg-zinc-50 p-5 ring-1 ring-zinc-950/5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-900">
              Matched
            </span>
            <span className="text-xs text-zinc-400">Ref #CM928</span>
          </div>

          <div className="flex items-start gap-4">
            <img
              src={marcus}
              alt="Marcus L."
              width={512}
              height={512}
              loading="lazy"
              className="size-12 shrink-0 rounded-[16px] object-cover outline-1 -outline-offset-1 outline-black/5"
            />
            <div>
              <div className="text-sm font-semibold text-zinc-900">Marcus L.</div>
              <div className="text-xs text-zinc-500">Silver Toyota Prius • 4.9 ★</div>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="z-10 size-2.5 rounded-full border-2 border-transit-car bg-sand" />
                <div className="-my-0.5 h-12 w-0.5 bg-zinc-200" />
              </div>
              <div className="pb-4">
                <div className="text-xs font-semibold text-zinc-900">11:00 PM Pickup</div>
                <div className="text-[11px] text-zinc-500">Library North Entrance</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="z-10 size-2.5 rounded-full bg-zinc-200" />
                <div className="-my-0.5 h-12 w-0.5 bg-zinc-200" />
              </div>
              <div className="pb-4">
                <div className="text-xs text-zinc-500">Route: Campus Blvd</div>
                <div className="text-[11px] text-zinc-400">Estimated 12 mins</div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="z-10 size-2.5 rounded-full bg-forest" />
              </div>
              <div>
                <div className="text-xs font-semibold text-zinc-900">11:15 PM Arrival</div>
                <div className="text-[11px] text-zinc-500">University Apartments B</div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="flex-1 rounded-[12px] bg-zinc-100 px-3 py-2 text-xs font-medium text-forest transition-colors hover:bg-zinc-200">
              Message
            </button>
            <button className="flex-1 rounded-[12px] border border-zinc-200 px-3 py-2 text-xs font-medium text-zinc-500">
              Cancel
            </button>
          </div>
        </div>

        <div className="opacity-50">
          <h2 className="mb-3 ml-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            Pending Requests
          </h2>
          <div className="flex items-center justify-between rounded-[16px] border border-dashed border-zinc-300 bg-zinc-50 p-4">
            <div className="text-xs text-zinc-600">Bus to North Station</div>
            <span className="text-[10px] text-zinc-400">10:15 PM</span>
          </div>
        </div>
      </div>
    </PhoneShell>
  );
}
