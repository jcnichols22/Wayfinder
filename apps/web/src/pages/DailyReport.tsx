import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface DailyRow {
  id: number;
  date: string;
  location: string;
  isOffice: boolean;
  start: string;
  end: string | null;
  durationFormatted: string;
  tickets: string;
  mileage: number;
  notes: string;
}

interface DaySplit {
  workingFormatted: string;
  adminFormatted: string;
  driveFormatted: string;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(localInput: string): string {
  return new Date(localInput).toISOString();
}

export default function DailyReport() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [visits, setVisits] = useState<DailyRow[]>([]);
  const [timeSplit, setTimeSplit] = useState<DaySplit | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api
      .getDailyReport(date)
      .then((res: any) => {
        setVisits(res.visits);
        setTimeSplit(res.timeSplit as DaySplit);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function openEdit(v: DailyRow) {
    setEditingId(v.id);
    setEditStart(toLocalInput(v.start));
    setEditEnd(v.end ? toLocalInput(v.end) : "");
    setSaveError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setSaveError(null);
  }

  async function saveEdit(v: DailyRow) {
    if (!editStart) {
      setSaveError("Start time is required.");
      return;
    }
    setSavingId(v.id);
    setSaveError(null);
    try {
      await api.updateVisit(v.id, {
        startTime: toIso(editStart),
        endTime: editEnd ? toIso(editEnd) : null,
      });
      setEditingId(null);
      load();
    } catch {
      setSaveError("Couldn't save changes. Please try again.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(visit: DailyRow) {
    const confirmed = window.confirm(
      `Delete the visit to "${visit.location}" on ${visit.date}? This removes its time, tickets, and mileage. This can't be undone.`
    );
    if (!confirmed) return;

    setDeletingId(visit.id);
    try {
      await api.deleteVisit(visit.id);
      setVisits((prev) => prev.filter((v) => v.id !== visit.id));
    } catch {
      alert("Couldn't delete this visit. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await api.downloadCsv("daily", { date });
    } catch {
      setExportError("Couldn't export the CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Daily Report</h1>

      <input
        type="date"
        className="input"
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />

      {timeSplit && visits.length > 0 && (
        <div className="card">
          <p className="mb-2 text-sm font-semibold text-slate-300">Time split</p>
          <ul className="flex flex-col gap-1.5">
            <li className="flex justify-between text-sm">
              <span>Working (on incidents)</span>
              <span className="text-slate-300">{timeSplit.workingFormatted}</span>
            </li>
            <li className="flex justify-between text-sm">
              <span>Admin (office)</span>
              <span className="text-slate-300">{timeSplit.adminFormatted}</span>
            </li>
            <li className="flex justify-between text-sm">
              <span>Driving</span>
              <span className="text-slate-300">{timeSplit.driveFormatted}</span>
            </li>
          </ul>
        </div>
      )}

      <button onClick={handleExport} disabled={exporting} className="btn-secondary text-center">
        {exporting ? "Exporting…" : "⬇ Export CSV"}
      </button>
      {exportError && <p className="text-sm text-red-400">{exportError}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : visits.length === 0 ? (
        <p className="text-sm text-slate-500">No visits recorded for this date.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {visits.map((v) => (
            <div key={v.id} className="card">
              {editingId === v.id ? (
                <div className="flex flex-col gap-3">
                  <h2 className="font-semibold">{v.location}</h2>
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      Start
                      <input
                        type="datetime-local"
                        className="input"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-slate-400">
                      End (blank to leave open)
                      <input
                        type="datetime-local"
                        className="input"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                      />
                    </label>
                  </div>
                  {saveError && <p className="text-xs text-red-400">{saveError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveEdit(v)}
                      disabled={savingId === v.id}
                      className="btn-primary flex-1 text-center"
                    >
                      {savingId === v.id ? "Saving…" : "Save"}
                    </button>
                    <button onClick={cancelEdit} className="btn-secondary flex-1 text-center">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">
                      {v.location}
                      {v.isOffice && (
                        <span className="ml-1.5 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] text-accent">
                          admin
                        </span>
                      )}
                    </h2>
                    <span className="text-sm text-accent">{v.durationFormatted}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(v.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} –{" "}
                    {v.end ? new Date(v.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </p>
                  {v.tickets && <p className="mt-2 text-sm font-mono text-slate-300">{v.tickets}</p>}
                  {v.mileage > 0 && <p className="mt-1 text-xs text-slate-400">{v.mileage} mi driven</p>}
                  {v.notes && <p className="mt-2 text-sm text-slate-300">{v.notes}</p>}

                  <div className="mt-3 flex gap-3 text-xs">
                    <button
                      onClick={() => openEdit(v)}
                      className="text-accent underline underline-offset-2"
                    >
                      Edit times
                    </button>
                    <button
                      onClick={() => handleDelete(v)}
                      disabled={deletingId === v.id}
                      className="text-red-400/80 underline underline-offset-2"
                    >
                      {deletingId === v.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}