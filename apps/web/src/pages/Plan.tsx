import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Location, PlanStop } from "../lib/api";

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-500/20 text-red-300",
  medium: "bg-amber-500/20 text-amber-300",
  low: "bg-surfaceInput text-slate-300",
};

export default function Plan() {
  const navigate = useNavigate();
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(true);

  const [mode, setMode] = useState<"saved" | "oneoff">("saved");
  const [selectedLocationId, setSelectedLocationId] = useState<number | "">("");
  const [oneOffLabel, setOneOffLabel] = useState("");
  const [oneOffAddress, setOneOffAddress] = useState("");
  const [ticketNumber, setTicketNumber] = useState("");
  const [priority, setPriority] = useState<string>("");
  const [reordering, setReordering] = useState(false);
  const [movingId, setMovingId] = useState<number | null>(null);

  // Per-stop inline ticket editing
  const [editingTicketId, setEditingTicketId] = useState<number | null>(null);
  const [editingTicketValue, setEditingTicketValue] = useState("");
  const [savingTicketId, setSavingTicketId] = useState<number | null>(null);
  const loadSeq = useRef(0);

  const sortedLocations = useMemo(
    () =>
      [...locations].sort((a, b) => {
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [locations]
  );

  async function load() {
    const seq = ++loadSeq.current;
    setLoading(true);
    const [planStops, locs] = await Promise.all([api.getPlan(), api.getLocations()]);
    if (seq !== loadSeq.current) return;
    setStops(planStops);
    setLocations(locs);
    setFormOpen((prev) => (planStops.length > 0 ? false : prev));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleAddStop() {
    setError(null);
    try {
      if (mode === "saved") {
        if (!selectedLocationId) return;
        await api.addPlanStop({
          locationId: Number(selectedLocationId),
          ticketNumber: ticketNumber || undefined,
          priority: priority || undefined,
        });
        setSelectedLocationId("");
      } else {
        if (!oneOffLabel.trim() || !oneOffAddress.trim()) return;
        await api.addPlanStop({
          label: oneOffLabel.trim(),
          address: oneOffAddress.trim(),
          ticketNumber: ticketNumber || undefined,
          priority: priority || undefined,
        });
        setOneOffLabel("");
        setOneOffAddress("");
      }
      setTicketNumber("");
      setPriority("");
      load();
    } catch {
      setError("Couldn't add that stop.");
    }
  }

  function openTicketEdit(stop: PlanStop) {
    setEditingTicketId(stop.id);
    setEditingTicketValue(stop.ticketNumber ?? "");
    setError(null);
  }

  function cancelTicketEdit() {
    setEditingTicketId(null);
    setEditingTicketValue("");
  }

  async function saveTicketEdit(stop: PlanStop) {
    const value = editingTicketValue.trim();
    setSavingTicketId(stop.id);
    setError(null);
    try {
      await api.updatePlanStop(stop.id, { ticketNumber: value || null });
      setEditingTicketId(null);
      setEditingTicketValue("");
      load();
    } catch {
      setError("Couldn't update the ticket number.");
    } finally {
      setSavingTicketId(null);
    }
  }

  async function toggleDone(stop: PlanStop) {
    await api.updatePlanStop(stop.id, { done: !stop.done });
    load();
  }

  async function remove(stop: PlanStop) {
    await api.deletePlanStop(stop.id);
    load();
  }

  async function handleStartVisit(stop: PlanStop) {
    setError(null);
    try {
      await api.startVisitFromPlan(stop.id);
      navigate("/");
    } catch (err: any) {
      setError(err?.message ?? "Couldn't start a visit from this stop.");
    }
  }

  async function clearDone() {
    await api.clearPlan(true);
    load();
  }

  async function clearAll() {
    const confirmed = window.confirm("Clear the entire plan? This can't be undone.");
    if (!confirmed) return;
    await api.clearPlan(false);
    load();
  }

  async function moveStopTo(stop: PlanStop, targetIndex: number) {
    if (movingId === stop.id) return;
    const currentIndex = stops.findIndex((s) => s.id === stop.id);
    if (currentIndex === -1 || currentIndex === targetIndex) return;

    setReordering(true);
    setError(null);
    try {
      const optimistic = [...stops];
      const [moved] = optimistic.splice(currentIndex, 1);
      optimistic.splice(targetIndex, 0, moved);
      setStops(optimistic);
      await api.reorderPlanStops(optimistic.map((s) => s.id));
    } catch {
      await load();
    } finally {
      setMovingId(null);
      setReordering(false);
    }
  }

  async function handleMoveUp(stop: PlanStop) {
    const index = stops.findIndex((s) => s.id === stop.id);
    if (index <= 0) return;
    await moveStopTo(stop, index - 1);
  }

  async function handleMoveDown(stop: PlanStop) {
    const index = stops.findIndex((s) => s.id === stop.id);
    if (index === -1 || index >= stops.length - 1) return;
    await moveStopTo(stop, index + 1);
  }

  async function handleMoveToTop(stop: PlanStop) {
    await moveStopTo(stop, 0);
  }

  async function handleMoveToBottom(stop: PlanStop) {
    await moveStopTo(stop, stops.length - 1);
  }

  if (loading) return <p className="text-slate-400">Loading…</p>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Day Plan</h1>
        <button
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-xl bg-surfaceInput px-4 py-2 text-sm font-medium"
        >
          {formOpen ? "Hide form" : "+ Add Stop"}
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</p>}

      {formOpen && (
        <div className="card flex flex-col gap-3">
          <p className="text-xs text-slate-400">
            Tap a stop's move buttons to reorder. Drive time shown is a distance reference from
            the previous stop, not a suggested route.
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => setMode("saved")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === "saved" ? "bg-accent text-slate-900" : "bg-surfaceInput text-slate-300"}`}
            >
              Saved Location
            </button>
            <button
              onClick={() => setMode("oneoff")}
              className={`flex-1 rounded-xl py-2 text-sm font-medium ${mode === "oneoff" ? "bg-accent text-slate-900" : "bg-surfaceInput text-slate-300"}`}
            >
              One-off Address
            </button>
          </div>

          {mode === "saved" ? (
            <select
              className="input"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select a location…</option>
              {sortedLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.favorite ? "★ " : ""}
                  {loc.name}
                </option>
              ))}
            </select>
          ) : (
            <>
              <input
                className="input"
                placeholder="Name (e.g. Coverage - Smith Clinic)"
                value={oneOffLabel}
                onChange={(e) => setOneOffLabel(e.target.value)}
              />
              <input
                className="input"
                placeholder="Address"
                value={oneOffAddress}
                onChange={(e) => setOneOffAddress(e.target.value)}
              />
            </>
          )}

          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Ticket # (optional)"
              value={ticketNumber}
              onChange={(e) => setTicketNumber(e.target.value)}
            />
            <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">No priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <button onClick={handleAddStop} className="btn-secondary">
            Add to Plan
          </button>
        </div>
      )}

      {stops.length > 0 && (
        <div className="flex gap-2">
          <button onClick={clearDone} className="btn-secondary flex-1 text-sm">
            Clear completed
          </button>
          <button onClick={clearAll} className="btn-secondary flex-1 text-sm text-red-400">
            Clear all
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {stops.length === 0 && (
          <p className="text-sm text-slate-500">No stops planned yet — add one above.</p>
        )}
        {stops.map((stop, i) => (
          <div
            key={stop.id}
            className={`card ${stop.done ? "opacity-50" : ""} ${reordering ? "opacity-60" : ""}`}
          >
            {stop.distanceFromPrevious && (
              <p className="mb-2 text-xs text-slate-500">
                ↳ {stop.distanceFromPrevious.miles} mi from previous stop
                {stop.distanceFromPrevious.estimated ? " (estimated)" : ""}
              </p>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`font-medium ${stop.done ? "line-through" : ""}`}>{stop.label}</p>
                  {stop.priority && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[stop.priority] ?? "bg-surfaceInput text-slate-300"}`}
                    >
                      {stop.priority}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{stop.address}</p>
                {stop.ticketNumber && editingTicketId !== stop.id && (
                  <p className="mt-1 text-xs font-mono text-slate-300">{stop.ticketNumber}</p>
                )}
              </div>
              <span className="text-xs text-slate-500">#{i + 1}</span>
            </div>

            {editingTicketId === stop.id ? (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  className="input"
                  placeholder="Ticket # (INC/SCTASK...)"
                  value={editingTicketValue}
                  onChange={(e) => setEditingTicketValue(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => saveTicketEdit(stop)}
                    disabled={savingTicketId === stop.id}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-slate-900 flex-1"
                  >
                    {savingTicketId === stop.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={cancelTicketEdit}
                    className="rounded-lg bg-surfaceInput px-3 py-1.5 text-sm flex-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {stop.locationId && !stop.done && (
                  <button
                    onClick={() => handleStartVisit(stop)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-slate-900"
                  >
                    Start Visit
                  </button>
                )}
                <button
                  onClick={() => openTicketEdit(stop)}
                  className="rounded-lg bg-surfaceInput px-3 py-1.5 text-sm"
                  title={stop.ticketNumber ? "Edit ticket number" : "Add a ticket number"}
                >
                  {stop.ticketNumber ? "Edit ticket" : "+ Ticket"}
                </button>
                <button
                  onClick={() => toggleDone(stop)}
                  className="rounded-lg bg-surfaceInput px-3 py-1.5 text-sm"
                >
                  {stop.done ? "Mark not done" : "Mark done"}
                </button>
                <button
                  onClick={() => remove(stop)}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-sm text-red-400"
                >
                  Remove
                </button>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    onClick={() => handleMoveToTop(stop)}
                    disabled={i === 0 || reordering}
                    className="rounded-lg bg-surfaceInput px-2 py-1.5 text-sm disabled:opacity-30"
                    title="Move to top"
                  >
                    ⤒
                  </button>
                  <button
                    onClick={() => handleMoveUp(stop)}
                    disabled={i === 0 || reordering}
                    className="rounded-lg bg-surfaceInput px-2 py-1.5 text-sm disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => handleMoveDown(stop)}
                    disabled={i === stops.length - 1 || reordering}
                    className="rounded-lg bg-surfaceInput px-2 py-1.5 text-sm disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => handleMoveToBottom(stop)}
                    disabled={i === stops.length - 1 || reordering}
                    className="rounded-lg bg-surfaceInput px-2 py-1.5 text-sm disabled:opacity-30"
                    title="Move to bottom"
                  >
                    ⤓
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}