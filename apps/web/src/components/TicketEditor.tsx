import { useState } from "react";

export interface TicketLike {
  id?: number;
  ticketNumber: string;
}

export default function TicketEditor({
  tickets,
  onAdd,
  onRemove,
}: {
  tickets: TicketLike[];
  onAdd: (ticketNumber: string) => void;
  onRemove?: (ticket: TicketLike) => void;
}) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue("");
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        <input
          className="input"
          placeholder="Ticket # (INC/SCTASK…)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          autoCapitalize="characters"
        />
        <button onClick={submit} className="btn-secondary shrink-0 px-5">
          Add
        </button>
      </div>
      {tickets.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {tickets.map((t, i) => (
            <li
              key={t.id ?? `${t.ticketNumber}-${i}`}
              className="flex items-center justify-between rounded-lg bg-surfaceInput/60 px-3 py-2 text-sm"
            >
              <span className="font-mono">{t.ticketNumber}</span>
              {onRemove && (
                <button
                  onClick={() => onRemove(t)}
                  className="text-slate-500 hover:text-red-400"
                  aria-label="Remove ticket"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
