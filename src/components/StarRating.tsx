// Read-only average display. `average === null` means no ratings yet —
// shown as a neutral label rather than a misleading "0 stars".
export function StarDisplay({
  average,
  count,
  emptyLabel = "New",
  className,
}: {
  average: number | null;
  count?: number;
  emptyLabel?: string;
  className?: string;
}) {
  if (average === null) {
    return <span className={className ?? "text-xs text-zinc-400"}>{emptyLabel}</span>;
  }

  return (
    <span className={className ?? "inline-flex items-center gap-1 text-xs text-zinc-600"}>
      <span aria-hidden="true" className="text-forest">
        ★
      </span>
      {average.toFixed(1)}
      {typeof count === "number" ? <span className="text-zinc-400"> ({count})</span> : null}
    </span>
  );
}

// Tap-to-select 1-5 star input. `value` of 0 means nothing selected yet.
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Star rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className="p-1 text-2xl leading-none"
        >
          <span className={n <= value ? "text-forest" : "text-zinc-300"}>★</span>
        </button>
      ))}
    </div>
  );
}
