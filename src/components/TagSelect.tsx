// Shared tag-button UI for the profile-enrichment form: PillSelect for
// single-select fields, TagMultiSelect for multi-select ones. Both render
// small option lists as tappable pills rather than a dropdown or long
// text form, per the low-friction goal for that page.

type PillSelectProps = {
  value: string | null;
  onChange: (value: string) => void;
  options: readonly string[];
};

export function PillSelect({ value, onChange, options }: PillSelectProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={
              selected
                ? "rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-sand"
                : "rounded-full bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

type TagMultiSelectProps = {
  value: readonly string[];
  onChange: (value: string[]) => void;
  options: readonly string[];
};

export function TagMultiSelect({ value, onChange, options }: TagMultiSelectProps) {
  const toggle = (option: string) => {
    onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = value.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={
              selected
                ? "rounded-full bg-forest px-3 py-1.5 text-xs font-medium text-sand"
                : "rounded-full bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200"
            }
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
};

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-[12px] bg-zinc-50 px-4 py-3 ring-1 ring-zinc-200"
    >
      <span className="text-left text-sm text-zinc-900">{label}</span>
      <span
        className={
          checked
            ? "relative h-6 w-11 shrink-0 rounded-full bg-forest transition-colors"
            : "relative h-6 w-11 shrink-0 rounded-full bg-zinc-300 transition-colors"
        }
      >
        <span
          className={
            checked
              ? "absolute left-[22px] top-0.5 size-5 rounded-full bg-sand transition-all"
              : "absolute left-0.5 top-0.5 size-5 rounded-full bg-sand transition-all"
          }
        />
      </span>
    </button>
  );
}
