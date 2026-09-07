import { useEffect, useState } from "react";
import { api } from "../lib/api";

interface MonthlyData {
  year: number;
  month: number;
  totalVisits: number;
  totalHoursFormatted: string;
  totalMileage: number;
  mostVisited: { name: string; count: number }[];
  visits: {
    date: string;
    location: string;
    durationFormatted: string;
    tickets: string;
    mileage: number;
  }[];
}

export default function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getMonthlyReport(year, month)
      .then((res) => setData(res as MonthlyData))
      .finally(() => setLoading(false));
  }, [year, month]);

  function changeMonth(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      await api.downloadCsv("monthly", { date: `${year}-${String(month).padStart(2, "0")}-01` });
    } catch {
      setExportError("Couldn't export the CSV. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Monthly Report</h1>

      <div className="flex items-center justify-between">
        <button onClick={() => changeMonth(-1)} className="btn-secondary px-4">
          ←
        </button>
        <span className="font-semibold">{monthLabel}</span>
        <button onClick={() => changeMonth(1)} className="btn-secondary px-4">
          →
        </button>
      </div>

      <button onClick={handleExport} disabled={exporting} className="btn-secondary text-center">
        {exporting ? "Exporting…" : "⬇ Export CSV"}
      </button>
      {exportError && <p className="text-sm text-red-400">{exportError}</p>}

      {loading || !data ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="card">
              <p className="text-xs text-slate-400">Total Visits</p>
              <p className="text-2xl font-bold">{data.totalVisits}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Time Onsite</p>
              <p className="text-2xl font-bold">{data.totalHoursFormatted}</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Mileage</p>
              <p className="text-2xl font-bold">{data.totalMileage} mi</p>
            </div>
            <div className="card">
              <p className="text-xs text-slate-400">Most Visited</p>
              <p className="text-lg font-bold">{data.mostVisited[0]?.name ?? "—"}</p>
            </div>
          </div>

          <div className="card">
            <p className="mb-2 text-sm font-semibold text-slate-300">All Visits</p>
            <div className="flex flex-col gap-2">
              {data.visits.map((v, i) => (
                <div key={i} className="flex items-center justify-between border-b border-borderMuted pb-2 text-sm last:border-0">
                  <span>
                    <span className="font-medium">{v.location}</span>
                    <span className="ml-2 text-slate-500">{v.date}</span>
                  </span>
                  <span className="text-slate-400">{v.durationFormatted}</span>
                </div>
              ))}
              {data.visits.length === 0 && (
                <p className="text-sm text-slate-500">No visits recorded this month.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
