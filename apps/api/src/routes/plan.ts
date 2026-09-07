import { Router } from "express";
import { prisma } from "../lib/prisma";
import { calculateMileage } from "../services/mileageProvider";
import { startVisit, VisitError } from "../services/visitService";

export const planRouter = Router();

/**
 * Returns today's plan stops in order, each annotated with the drive distance
 * from the previous stop (not GPS - address-to-address via the mileage provider,
 * same as automatic visit mileage). The first stop has no "previous" distance.
 */
planRouter.get("/", async (_req, res) => {
  const stops = await prisma.planStop.findMany({
    orderBy: { order: "asc" },
    include: { location: true },
  });

  const enriched = await enrichStopsWithDistances(stops);
  res.json(enriched);
});

planRouter.post("/", async (req, res) => {
  const { locationId, label, address, ticketNumber, priority } = req.body ?? {};

  let resolvedLabel = label;
  let resolvedAddress = address;

  if (locationId) {
    const location = await prisma.location.findUnique({ where: { id: Number(locationId) } });
    if (!location) return res.status(404).json({ error: "Location not found" });
    resolvedLabel = location.name;
    resolvedAddress = location.address;
  }

  if (!resolvedLabel || !resolvedAddress) {
    return res.status(400).json({ error: "Either locationId, or both label and address, are required" });
  }

  const maxOrder = await prisma.planStop.aggregate({ _max: { order: true } });
  const nextOrder = (maxOrder._max.order ?? 0) + 1;

  const stop = await prisma.planStop.create({
    data: {
      locationId: locationId ? Number(locationId) : null,
      label: resolvedLabel,
      address: resolvedAddress,
      ticketNumber: ticketNumber || null,
      priority: priority || null,
      order: nextOrder,
    },
    include: { location: true },
  });

  res.status(201).json(stop);
});

planRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { done, priority, ticketNumber, label, address } = req.body ?? {};
  try {
    const stop = await prisma.planStop.update({
      where: { id },
      data: {
        ...(done !== undefined && { done }),
        ...(priority !== undefined && { priority }),
        ...(ticketNumber !== undefined && { ticketNumber }),
        ...(label !== undefined && { label }),
        ...(address !== undefined && { address }),
      },
      include: { location: true },
    });
    res.json(stop);
  } catch {
    res.status(404).json({ error: "Plan stop not found" });
  }
});

// Move a stop up or down one position by swapping  with its neighbor
planRouter.post("/:id/move", async (req, res) => {
  const id = Number(req.params.id);
  const { direction } = req.body ?? {};
  if (direction !== "up" && direction !== "down") {
    return res.status(400).json({ error: 'direction must be up or down' });
  }

  const stops = await prisma.planStop.findMany({ orderBy: { order: "asc" } });
  const index = stops.findIndex((s: { id: number }) => s.id === id);
  if (index === -1) return res.status(404).json({ error: "Plan stop not found" });

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= stops.length) {
    return res.json(stops); // already at the edge, no-op
  }

  const a = stops[index];
  const b = stops[swapIndex];

  await prisma.$transaction([
    prisma.planStop.update({ where: { id: a.id }, data: { order: b.order } }),
    prisma.planStop.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);

  const updated = await prisma.planStop.findMany({ orderBy: { order: "asc" }, include: { location: true } });
  const enriched = updated;
  res.json(enriched);
});

// Reorder all stops in one shot. Accepts the full ordered array of stop IDs.
planRouter.post("/reorder", async (req, res) => {
  const { stopIds } = req.body ?? {};
  if (!Array.isArray(stopIds) || stopIds.length === 0) {
    return res.status(400).json({ error: "stopIds must be a non-empty array" });
  }

  const stops = await prisma.planStop.findMany({
    orderBy: { order: "asc" },
    include: { location: true },
  });

  const stopMap = new Map(stops.map((s) => [s.id, s]));
  if (stopIds.some((id: number) => !stopMap.has(id))) {
    return res.status(400).json({ error: "stopIds must contain all current stop IDs" });
  }
  await prisma.$transaction(
    stopIds.map((id: number, index: number) =>
      prisma.planStop.update({ where: { id }, data: { order: index } })
    )
  );

  const updated = await prisma.planStop.findMany({ orderBy: { order: "asc" }, include: { location: true } });
  const enriched = updated;
  res.json(enriched);
});

// Quick-start a visit directly from a plan stop (only valid for stops tied to a saved Location)
planRouter.post("/:id/start-visit", async (req, res) => {
  const id = Number(req.params.id);
  const stop = await prisma.planStop.findUnique({ where: { id } });
  if (!stop) return res.status(404).json({ error: "Plan stop not found" });
  if (!stop.locationId) {
    return res.status(400).json({
      error: "This stop isn't linked to a saved Location. Add it as a Location first, or start the visit manually from Home.",
    });
  }

  try {
    const visit = await startVisit({
      locationId: stop.locationId,
      tickets: stop.ticketNumber ? [stop.ticketNumber] : undefined,
    });
    await prisma.planStop.update({ where: { id }, data: { done: true } });
    res.status(201).json(visit);
  } catch (err) {
    if (err instanceof VisitError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to start visit" });
  }
});

planRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.planStop.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Plan stop not found" });
  }
});

// Bulk clear - ?onlyDone=true clears just completed stops, otherwise clears the whole plan
planRouter.delete("/", async (req, res) => {
  const onlyDone = req.query.onlyDone === "true";
  await prisma.planStop.deleteMany({ where: onlyDone ? { done: true } : undefined });
  res.json({ ok: true });
});

async function enrichStopsWithDistances(stops: any[]) {
  const distances = await Promise.all(
    stops.map(async (stop: { address: string }, i: number) => {
      if (i === 0) return null;
      const prev = stops[i - 1];
      try {
        const result = await calculateMileage(prev.address, stop.address);
        return { miles: result.distanceMiles, estimated: result.estimated };
      } catch {
        return { miles: 0, estimated: true };
      }
    })
  );
  return stops.map((stop: object, i: number) => ({ ...stop, distanceFromPrevious: distances[i] }));
}
