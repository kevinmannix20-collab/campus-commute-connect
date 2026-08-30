import type { DriverTier } from "@/lib/priorityScore";

const TIER_STYLES: Record<NonNullable<DriverTier>, { label: string; className: string }> = {
  gold: { label: "Gold Driver", className: "bg-forest text-sand" },
  silver: { label: "Silver Driver", className: "bg-zinc-200 text-zinc-700" },
  bronze: { label: "Bronze Driver", className: "bg-zinc-100 text-zinc-600" },
};

// Doubles as the "why is this surfaced first" explanation for reciprocal
// karma — a driver with real history gets a self-explanatory badge instead
// of a hidden ranking boost.
export function TierBadge({ tier }: { tier: DriverTier }) {
  if (!tier) return null;
  const { label, className } = TIER_STYLES[tier];

  return (
    <span className={`rounded-md px-2 py-0.5 text-[9px] font-bold tracking-wide ${className}`}>
      {label}
    </span>
  );
}
