import { useEffect, useRef, useState } from "react";

type Props = {
  id?: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
};

// A tap-to-open, type-to-filter select — the same interaction shape as
// PlaceAutocompleteInput (an input that reveals a suggestion list), reused
// here for fixed option lists instead of Google Places results.
export function SearchableSelect({ id, value, onChange, options, placeholder, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter((option) =>
    option.toLowerCase().includes(query.trim().toLowerCase()),
  );

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const openList = () => {
    setOpen(true);
    setQuery("");
    setHighlighted(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const select = (option: string) => {
    onChange(option);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={openList}
        className={
          className ??
          "flex w-full items-center rounded-[12px] bg-zinc-50 px-4 py-3 text-left text-sm outline-none ring-1 ring-zinc-200"
        }
      >
        <span className={value ? "text-zinc-900" : "text-zinc-400"}>
          {value ?? placeholder ?? "Select…"}
        </span>
      </button>

      {open ? (
        <div className="absolute inset-x-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-[12px] bg-white shadow-lg ring-1 ring-zinc-200">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlighted((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const match = filtered[highlighted];
                if (match) select(match);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setOpen(false);
                setQuery("");
              }
            }}
            placeholder="Search…"
            className="w-full border-b border-zinc-100 px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-2 text-xs text-zinc-400">No matches</li>
            ) : (
              filtered.map((option, i) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => select(option)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={
                      i === highlighted
                        ? "w-full px-4 py-2 text-left text-sm text-forest bg-forest/5"
                        : "w-full px-4 py-2 text-left text-sm text-zinc-700"
                    }
                  >
                    {option}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
