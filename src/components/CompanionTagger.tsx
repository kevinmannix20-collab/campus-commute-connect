import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type TaggedCompanion = { id: string; display_name: string };

type Props = {
  selected: TaggedCompanion[];
  onChange: (companions: TaggedCompanion[]) => void;
};

// Lets the poster of a car request tag other real accounts (friends also
// wanting a ride) directly on the request. Search is debounced client-side
// against search_profiles(), a SECURITY DEFINER RPC — profiles' own RLS
// only lets a user read their own row, so a plain table query can't find
// anyone else.
export function CompanionTagger({ selected, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaggedCompanion[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_profiles", { p_query: trimmed });
      setSearching(false);
      if (error) return;
      const selectedIds = new Set(selected.map((c) => c.id));
      setResults((data ?? []).filter((r) => !selectedIds.has(r.id)));
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, selected]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const addCompanion = (companion: TaggedCompanion) => {
    onChange([...selected, companion]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removeCompanion = (id: string) => {
    onChange(selected.filter((c) => c.id !== id));
  };

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((companion) => (
            <span
              key={companion.id}
              className="flex items-center gap-1 rounded-full bg-forest/10 py-1 pl-2.5 pr-1.5 text-xs font-medium text-forest"
            >
              {companion.display_name}
              <button
                type="button"
                onClick={() => removeCompanion(companion.id)}
                aria-label={`Remove ${companion.display_name}`}
                className="flex size-4 items-center justify-center rounded-full text-forest/60 hover:bg-forest/10 hover:text-forest"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <div className="flex w-full items-center gap-3 rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200">
        <div className="size-2 rounded-full border border-dashed border-forest" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Tag friends riding with you..."
          autoComplete="off"
          className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
        />
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-48 overflow-y-auto rounded-[12px] bg-white p-1.5 shadow-lg ring-1 ring-zinc-950/5">
          {searching ? (
            <p className="px-3 py-2 text-xs text-zinc-400">Searching…</p>
          ) : results.length > 0 ? (
            results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => addCompanion(result)}
                className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-sm text-zinc-900 hover:bg-forest/5"
              >
                <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-forest/10 text-xs font-semibold text-forest">
                  {result.display_name.charAt(0) || "?"}
                </div>
                {result.display_name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-xs text-zinc-400">No students found.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
