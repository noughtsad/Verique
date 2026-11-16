import { cn } from '@/lib/utils';

export function Tabs<T extends string>({
  value,
  onChange,
  items,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string; count?: number }[];
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="no-scrollbar flex gap-1 overflow-x-auto border-b border-line">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative shrink-0 px-4 pb-3 pt-1 text-sm font-semibold transition-colors',
              active ? 'text-white' : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 text-zinc-500">{item.count}</span>}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" />}
          </button>
        );
      })}
    </div>
  );
}
