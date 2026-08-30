import { Info } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Small tap/hover-to-reveal explainer, for collapsing a paragraph of
// caption text into a single icon next to whatever it's explaining.
export function InfoTooltip({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <span ref={containerRef} className={`relative inline-flex ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={() => setOpen(true)}
        aria-label="More info"
        aria-expanded={open}
        className="flex items-center text-current opacity-50 transition-opacity hover:opacity-100"
      >
        <Info className="size-3" />
      </button>
      {open ? (
        <span className="absolute left-1/2 top-full z-30 mt-1.5 w-48 -translate-x-1/2 text-balance rounded-[10px] bg-zinc-900 px-2.5 py-2 text-[10px] leading-snug text-white shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  );
}
