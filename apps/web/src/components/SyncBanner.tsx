import { useEffect, useState } from "react";
import { flushQueue, getQueue, isOnline, QueuedAction } from "../lib/offlineQueue";

export default function SyncBanner() {
  const [online, setOnline] = useState(isOnline());
  const [pending, setPending] = useState(0);
  const [items, setItems] = useState<QueuedAction[]>([]);
  const [expanded, setExpanded] = useState(false);

  async function refreshPending() {
    const queue = await getQueue();
    setPending(queue.length);
    setItems(queue);
  }

  async function trySync() {
    if (!isOnline()) return;
    const result = await flushQueue();
    if (result.synced > 0 || result.failed > 0) await refreshPending();
  }

  useEffect(() => {
    refreshPending();
    const onOnline = () => {
      setOnline(true);
      trySync();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const interval = setInterval(trySync, 30000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearInterval(interval);
    };
  }, []);

  if (online && pending === 0) return null;

  const formatTime = (iso: string) => new Date(iso).toLocaleTimeString();

  return (
    <div
      className={`w-full px-4 py-2 text-center text-sm font-medium ${
        online ? "bg-amber-500/20 text-amber-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {!online
        ? "You're offline — visits and tickets are being saved on this device."
        : `Syncing ${pending} pending item${pending === 1 ? "" : "s"}…`}
      {online && pending > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-2 underline"
        >
          {expanded ? "Hide" : "Details"}
        </button>
      )}
      {expanded && items.length > 0 && (
        <div className="mt-2 rounded bg-black/30 p-2 text-left text-xs">
          {items.map((item) => (
            <div key={item.clientId} className="flex flex-col gap-0.5">
              <span className="font-semibold">{item.type.replace(/_/g, " ")}</span>
              <span className="text-slate-300">
                {item.payload.locationName ?? `Location #${item.payload.locationId}`}
                {item.payload.tickets?.length ? ` — ${item.payload.tickets.length} ticket(s)` : ""}
              </span>
              <span className="text-slate-500">Queued at {formatTime(item.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
