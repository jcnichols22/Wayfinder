import { useEffect, useState } from "react";
import { api, DashboardData } from "../lib/api";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch(() => setError("Couldn't load dashboard data."));
  }, []);

  if (error) return <p className="text-amber-400">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading…</p>;

  const ts = data.timeSplit;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {data.activeVisit && (
        <div className="card border-accent/60 bg-accent/10">
          <p className="text-xs uppercase tracking-wide text-accent">Active Visit</p>
          <p className="text-lg font-semibold">{data.activeVisit.location.name}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Visits this month" value={data.visitsThisMonth} />
        <StatCard label="Hours onsite" value={data.hoursOnsiteThisMonth} />
        <StatCard label="Mileage" value={`${data.mileageThisMonth} mi`} />
        <StatCard label="Top location" value={data.topLocations[0]?.name ?? "—"} />
      </div>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-slate-300">Time this month</p>
        <ul className="flex flex-col gap-1.5">
          <li className="flex justify-between text-sm">
            <span>Working (on incidents)</span>
            <span className="text-slate-300">{ts.workingFormatted}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span>Admin (office)</span>
            <span className="text-slate-300">{ts.adminFormatted}</span>
          </li>
          <li className="flex justify-between text-sm">
            <span>Driving</span>
            <span className="text-slate-300">{ts.driveFormatted}</span>
          </li>
          <li className="flex justify-between text-sm border-t border-borderMuted pt-1.5">
            <span>Total</span>
            <span className="font-medium text-slate-200">{ts.totalFormatted}</span>
          </li>
        </ul>
      </div>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-slate-300">Top Locations</p>
        <ul className="flex flex-col gap-1.5">
          {data.topLocations.map((loc) => (
            <li key={loc.name} className="flex justify-between text-sm">
              <span>{loc.name}</span>
              <span className="text-slate-400">{loc.count} visits</span>
            </li>
          ))}
          {data.topLocations.length === 0 && (
            <p className="text-sm text-slate-500">No visits yet this month.</p>
          )}
        </ul>
      </div>

      <div className="card">
        <p className="mb-2 text-sm font-semibold text-slate-300">Recent Visits</p>
        <ul className="flex flex-col gap-2">
          {data.recentVisits.map((v) => (
            <li key={v.id} className="flex items-center justify-between text-sm">
              <span>
                <span className="font-medium">{v.location.name}</span>
                <span className="ml-2 text-slate-500">
                  {new Date(v.startTime).toLocaleDateString()}
                </span>
              </span>
              <span className="text-slate-400">{v.tickets.length} tickets</span>
            </li>
          ))}
          {data.recentVisits.length === 0 && (
            <p className="text-sm text-slate-500">No visits recorded yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}