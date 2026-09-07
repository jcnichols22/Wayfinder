import { useEffect, useState, useCallback } from "react";
import { api, Location, Visit } from "../lib/api";
import LocationPicker from "../components/LocationPicker";
import TicketEditor from "../components/TicketEditor";
import { useLiveDuration } from "../hooks/useLiveDuration";
import {
  addTicketToQueuedStart,
  enqueueAction,
  flushQueue,
  getPendingVisit,
  getQueue,
  isOnline,
  PendingVisit,
  removeQueuedVisit,
  setPendingVisit,
} from "../lib/offlineQueue";

export default function Home() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [activeVisit, setActiveVisit] = useState<Visit | null>(null);
  const [pendingVisit, setPendingVisitState] = useState<PendingVisit | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [draftTickets, setDraftTickets] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locs, visit] = await Promise.all([api.getLocations(), api.getActiveVisit()]);
      setLocations(locs);
      setActiveVisit(visit);
    } catch (err) {
      setError("Couldn't reach the server. Showing offline data if available.");
    } finally {
      const pv = await getPendingVisit();
      setPendingVisitState(pv);
      if (pv) setNotes(pv.notes);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Attempt a sync whenever we come back online, then refresh state
  useEffect(() => {
    async function trySync() {
      if (!isOnline()) return;
      await flushQueue();
      const queue = await getQueue();
      const pv = await getPendingVisit();
      if (pv) {
        const stillQueued = queue.some(
          (a) => a.clientId === pv.clientId || a.payload?.startClientId === pv.clientId
        );
        if (!stillQueued) {
          await setPendingVisit(null);
          setPendingVisitState(null);
          load();
        }
      }
    }
    trySync();
    window.addEventListener("online", trySync);
    return () => window.removeEventListener("online", trySync);
  }, [load]);

  const currentLocation = activeVisit?.location ?? locations.find((l) => l.id === pendingVisit?.locationId);
  const startTimeForTimer = activeVisit?.startTime ?? pendingVisit?.startTime ?? null;
  const liveDuration = useLiveDuration(activeVisit || pendingVisit ? startTimeForTimer : null);

  async function handleStartVisit() {
    if (!selectedLocationId) return;
    setBusy(true);
    setError(null);
    const location = locations.find((l) => l.id === selectedLocationId)!;
    const startTime = new Date().toISOString();

    try {
      const visit = await api.startVisit({
        locationId: selectedLocationId,
        tickets: draftTickets,
        startTime,
      });
      setActiveVisit(visit);
      setDraftTickets([]);
      setSelectedLocationId(null);
    } catch (err) {
      // Offline (or server unreachable) fallback: queue the action and track a local pending visit
      const action = await enqueueAction("start_visit", {
        locationId: selectedLocationId,
        tickets: draftTickets,
        startTime,
      });
      const pv: PendingVisit = {
        clientId: action.clientId,
        locationId: selectedLocationId,
        locationName: location.name,
        locationAddress: location.address,
        startTime,
        endTime: null,
        tickets: draftTickets,
        notes: "",
      };
      await setPendingVisit(pv);
      setPendingVisitState(pv);
      setDraftTickets([]);
      setSelectedLocationId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTicket(ticketNumber: string) {
    if (activeVisit) {
      try {
        await api.addTicket(activeVisit.id, ticketNumber);
        setActiveVisit({ ...activeVisit, tickets: [...activeVisit.tickets, { id: Date.now(), visitId: activeVisit.id, ticketNumber, createdAt: new Date().toISOString() }] });
      } catch {
        await enqueueAction("add_ticket", { visitId: activeVisit.id, ticketNumber });
        setActiveVisit({ ...activeVisit, tickets: [...activeVisit.tickets, { id: Date.now(), visitId: activeVisit.id, ticketNumber, createdAt: new Date().toISOString() }] });
      }
    } else if (pendingVisit) {
      const updated = { ...pendingVisit, tickets: [...pendingVisit.tickets, ticketNumber] };
      await addTicketToQueuedStart(pendingVisit.clientId, ticketNumber);
      await setPendingVisit(updated);
      setPendingVisitState(updated);
    } else {
      setDraftTickets((prev) => [...prev, ticketNumber]);
    }
  }

  async function handleEndVisit() {
    setBusy(true);
    setError(null);
    try {
      if (activeVisit) {
        if (notes !== (activeVisit.notes ?? "")) {
          await api.updateVisitNotes(activeVisit.id, notes);
        }
        await api.endVisit(activeVisit.id, new Date().toISOString());
        setActiveVisit(null);
        setNotes("");
      } else if (pendingVisit) {
        await enqueueAction("end_visit", {
          startClientId: pendingVisit.clientId,
          endTime: new Date().toISOString(),
        });
        await setPendingVisit(null);
        setPendingVisitState(null);
        setNotes("");
      }
    } catch (err) {
      if (activeVisit) {
        await enqueueAction("end_visit", { visitId: activeVisit.id, endTime: new Date().toISOString() });
        setActiveVisit(null);
        setNotes("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelVisit() {
    const confirmed = window.confirm(
      "Cancel this visit? It will be removed completely — no time, tickets, or mileage will be recorded."
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      if (activeVisit) {
        await api.deleteVisit(activeVisit.id);
        setActiveVisit(null);
        setNotes("");
      } else if (pendingVisit) {
        // Never synced to the server - just drop it locally
        await removeQueuedVisit(pendingVisit.clientId);
        await setPendingVisit(null);
        setPendingVisitState(null);
        setNotes("");
      }
    } catch (err) {
      setError("Couldn't cancel the visit. Try again once you're back online.");
    } finally {
      setBusy(false);
    }
  }


  if (loading) return <p className="text-slate-400">Loading…</p>;

  const hasActive = Boolean(activeVisit || pendingVisit);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <img src="/icons/icon-192.png" alt="" className="h-8 w-8 rounded-lg" />
        <h1 className="text-2xl font-bold">Wayfinder</h1>
      </div>
      {error && <p className="text-sm text-amber-400">{error}</p>}

      {hasActive ? (
        <div className="card flex flex-col gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-slate-400">Current Visit</p>
            <h2 className="text-xl font-semibold">{currentLocation?.name ?? "Unknown location"}</h2>
            <p className="text-sm text-slate-400">{currentLocation?.address}</p>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surfaceInput/60 px-4 py-3">
            <div>
              <p className="text-xs text-slate-400">Started</p>
              <p className="font-medium">
                {new Date(startTimeForTimer as string).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Duration</p>
              <p className="text-2xl font-bold text-accent">{liveDuration}</p>
            </div>
          </div>

          <div>
            <p className="mb-1 text-sm text-slate-300">Tickets</p>
            <TicketEditor
              tickets={
                activeVisit
                  ? activeVisit.tickets
                  : (pendingVisit?.tickets ?? []).map((t) => ({ ticketNumber: t }))
              }
              onAdd={handleAddTicket}
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Notes</span>
            <textarea
              className="input min-h-[80px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Work performed, follow-ups, etc."
            />
          </label>

          <button onClick={handleEndVisit} disabled={busy} className="btn-danger">
            {busy ? "Ending…" : "End Visit"}
          </button>
          <button
            onClick={handleCancelVisit}
            disabled={busy}
            className="text-center text-sm text-slate-500 underline underline-offset-2"
          >
            Cancel visit (started by mistake)
          </button>
        </div>
      ) : (
        <div className="card flex flex-col gap-4">
          <p className="text-sm uppercase tracking-wide text-slate-400">No Active Visit</p>

          <div>
            <p className="mb-1 text-sm text-slate-300">Location</p>
            <LocationPicker
              locations={locations}
              selectedId={selectedLocationId}
              onSelect={setSelectedLocationId}
            />
          </div>

          <div>
            <p className="mb-1 text-sm text-slate-300">Tickets (optional)</p>
            <TicketEditor
              tickets={draftTickets.map((t) => ({ ticketNumber: t }))}
              onAdd={(t) => setDraftTickets((prev) => [...prev, t])}
              onRemove={(t) => setDraftTickets((prev) => prev.filter((x) => x !== t.ticketNumber))}
            />
          </div>

          <button
            onClick={handleStartVisit}
            disabled={!selectedLocationId || busy}
            className="btn-primary"
          >
            {busy ? "Starting…" : "Start Visit"}
          </button>
        </div>
      )}
    </div>
  );
}
