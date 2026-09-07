import { useMemo, useState } from "react";
import { Location } from "../lib/api";

export default function LocationPicker({
  locations,
  selectedId,
  onSelect,
}: {
  locations: Location[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? locations.filter(
          (l) => l.name.toLowerCase().includes(q) || l.address.toLowerCase().includes(q)
        )
      : locations;
    return [...list].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [locations, query]);

  return (
    <div>
      <input
        className="input mb-3"
        placeholder="Search locations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {filtered.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onSelect(loc.id)}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
              selectedId === loc.id
                ? "border-accent bg-accent/10"
                : "border-borderMuted bg-surfaceInput/60"
            }`}
          >
            <span>
              <span className="block font-medium">
                {loc.favorite ? "⭐ " : ""}
                {loc.name}
              </span>
              <span className="block text-xs text-slate-400">{loc.address}</span>
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-500">No locations match your search.</p>
        )}
      </div>
    </div>
  );
}
