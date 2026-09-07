import { Router } from "express";
import { prisma } from "../lib/prisma";
import { buildVisitsCsv, formatDuration } from "../services/csv";

export const reportsRouter = Router();

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function getVisitsInRange(from: Date, to: Date) {
  return prisma.visit.findMany({
    where: { startTime: { gte: from, lte: to } },
    include: { tickets: true, location: true, mileage: true },
    orderBy: { startTime: "asc" },
  });
}

type VisitWithRelations = Awaited<ReturnType<typeof getVisitsInRange>>[number];

function toRow(visit: VisitWithRelations) {
  return {
    id: visit.id,
    date: visit.startTime.toISOString().slice(0, 10),
    location: visit.location.name,
    start: visit.startTime.toISOString(),
    end: visit.endTime ? visit.endTime.toISOString() : "",
    durationMinutes: visit.durationMinutes,
    durationFormatted: formatDuration(visit.durationMinutes),
    tickets: visit.tickets.map((t: { ticketNumber: string }) => t.ticketNumber).join("; "),
    mileage: visit.mileage?.distanceMiles ?? 0,
    notes: visit.notes ?? "",
  };
}

// Daily report
reportsRouter.get("/daily", async (req, res) => {
  const dateParam = req.query.date ? new Date(String(req.query.date)) : new Date();
  const visits = await getVisitsInRange(startOfDay(dateParam), endOfDay(dateParam));
  res.json({ date: dateParam.toISOString().slice(0, 10), visits: visits.map(toRow) });
});

// Monthly report
reportsRouter.get("/monthly", async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1; // 1-12
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59, 999);

  const visits = await getVisitsInRange(from, to);
  const totalVisits = visits.length;
  const totalMinutes = visits.reduce((sum: number, v: VisitWithRelations) => sum + (v.durationMinutes ?? 0), 0);
  const totalMileage = visits.reduce((sum: number, v: VisitWithRelations) => sum + (v.mileage?.distanceMiles ?? 0), 0);

  const locationCounts = new Map<string, number>();
  for (const v of visits) {
    locationCounts.set(v.location.name, (locationCounts.get(v.location.name) ?? 0) + 1);
  }
  const mostVisited = [...locationCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  res.json({
    year,
    month,
    totalVisits,
    totalMinutes,
    totalHoursFormatted: formatDuration(totalMinutes),
    totalMileage: Math.round(totalMileage * 10) / 10,
    mostVisited,
    visits: visits.map(toRow),
  });
});

// Dashboard summary
reportsRouter.get("/dashboard", async (_req, res) => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const visits = await getVisitsInRange(monthStart, monthEnd);
  const totalMinutes = visits.reduce((sum: number, v: VisitWithRelations) => sum + (v.durationMinutes ?? 0), 0);
  const totalMileage = visits.reduce((sum: number, v: VisitWithRelations) => sum + (v.mileage?.distanceMiles ?? 0), 0);

  const locationCounts = new Map<string, number>();
  for (const v of visits) {
    locationCounts.set(v.location.name, (locationCounts.get(v.location.name) ?? 0) + 1);
  }
  const topLocations = [...locationCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentVisits = await prisma.visit.findMany({
    take: 5,
    orderBy: { startTime: "desc" },
    include: { tickets: true, location: true },
  });

  const activeVisit = await prisma.visit.findFirst({
    where: { endTime: null },
    include: { tickets: true, location: true },
  });

  res.json({
    visitsThisMonth: visits.length,
    hoursOnsiteThisMonth: formatDuration(totalMinutes),
    minutesOnsiteThisMonth: totalMinutes,
    mileageThisMonth: Math.round(totalMileage * 10) / 10,
    topLocations,
    recentVisits,
    activeVisit,
  });
});

// CSV export: daily | weekly | monthly | custom
reportsRouter.get("/export/csv", async (req, res) => {
  const { range, from, to, date } = req.query as Record<string, string | undefined>;

  let fromDate: Date;
  let toDate: Date;

  const base = date ? new Date(date) : new Date();

  switch (range) {
    case "daily":
      fromDate = startOfDay(base);
      toDate = endOfDay(base);
      break;
    case "weekly": {
      const day = base.getDay(); // 0 = Sunday
      const start = new Date(base);
      start.setDate(base.getDate() - day);
      fromDate = startOfDay(start);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      toDate = endOfDay(end);
      break;
    }
    case "monthly":
      fromDate = new Date(base.getFullYear(), base.getMonth(), 1);
      toDate = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case "custom":
    default:
      if (!from || !to) {
        return res.status(400).json({ error: "from and to are required for custom range" });
      }
      fromDate = startOfDay(new Date(from));
      toDate = endOfDay(new Date(to));
      break;
  }

  const visits = await getVisitsInRange(fromDate, toDate);
  const csv = buildVisitsCsv(visits.map(toRow));

  const filename = `field-tracker-${range ?? "custom"}-${fromDate.toISOString().slice(0, 10)}_to_${toDate
    .toISOString()
    .slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
});
