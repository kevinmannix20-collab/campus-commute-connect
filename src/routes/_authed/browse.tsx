import { createFileRoute } from "@tanstack/react-router";

import david from "@/assets/student-david.jpg";
import emma from "@/assets/student-emma.jpg";
import sarah from "@/assets/student-sarah.jpg";
import { PhoneShell } from "@/components/PhoneShell";

export const Route = createFileRoute("/_authed/browse")({
  head: () => ({
    meta: [
      { title: "Open Commutes — Commute Mate" },
      {
        name: "description",
        content:
          "Scroll open student commute requests, join someone on the bus, or offer an empty seat in your car for the trip home.",
      },
      { property: "og:title", content: "Open Commutes — Commute Mate" },
      {
        property: "og:description",
        content:
          "Join a classmate on the bus or offer an empty seat in your car for tonight's trip home.",
      },
    ],
  }),
  component: BrowseScreen,
});

type Submission = {
  name: string;
  avatar: string;
  tag: "Bus Buddy" | "Needs Ride";
  destination: string;
  detail: string;
};

const submissions: Submission[] = [
  {
    name: "Sarah J.",
    avatar: sarah,
    tag: "Bus Buddy",
    destination: "Elm Street Station",
    detail: "Time: 11:30 PM",
  },
  {
    name: "David K.",
    avatar: david,
    tag: "Needs Ride",
    destination: "Campus East Lofts",
    detail: "Time: 12:00 AM • 1 seat",
  },
  {
    name: "Emma W.",
    avatar: emma,
    tag: "Bus Buddy",
    destination: "Downtown Hub",
    detail: "Time: 11:15 PM",
  },
];

function BrowseScreen() {
  return (
    <PhoneShell active="browse">
      <header className="sticky top-0 z-20 bg-sand p-6 pb-2">
        <h1 className="font-serif text-2xl font-medium leading-tight text-forest">
          Open Commutes
        </h1>
        <p className="mt-1 max-w-[40ch] text-pretty text-xs text-zinc-500">
          Help a classmate get home safely tonight.
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        {submissions.map((s) => (
          <div
            key={s.name}
            className="space-y-3 rounded-[20px] bg-zinc-50 p-4 ring-1 ring-zinc-950/5"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={s.avatar}
                  alt={s.name}
                  width={512}
                  height={512}
                  loading="lazy"
                  className="size-8 rounded-[10px] object-cover outline-1 -outline-offset-1 outline-black/5"
                />
                <span className="text-sm font-semibold">{s.name}</span>
              </div>
              <span
                className={
                  s.tag === "Bus Buddy"
                    ? "rounded-md bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-900"
                    : "rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-900"
                }
              >
                {s.tag}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-zinc-300" />
                To: {s.destination}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="size-1.5 rounded-full bg-zinc-300" />
                {s.detail}
              </div>
            </div>
            {s.tag === "Bus Buddy" ? (
              <button className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-forest py-2 pl-2 pr-3 text-xs font-medium text-sand shadow-sm ring-1 ring-forest">
                <svg
                  className="size-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Join Commute
              </button>
            ) : (
              <button className="flex w-full items-center justify-center gap-2 rounded-[12px] py-2 pl-2 pr-3 text-xs font-medium text-forest ring-1 ring-forest hover:bg-forest/5">
                Offer a Ride
              </button>
            )}
          </div>
        ))}
      </div>
    </PhoneShell>
  );
}
