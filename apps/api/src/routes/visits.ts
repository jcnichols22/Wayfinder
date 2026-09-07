import { Router } from "express";
import { prisma } from "../lib/prisma";
import { startVisit, endVisit, VisitError } from "../services/visitService";

export const visitsRouter = Router();

// Current active visit (if any)
visitsRouter.get("/active", async (_req, res) => {
  const visit = await prisma.visit.findFirst({
    where: { endTime: null },
    include: { tickets: true, location: true },
  });
  res.json(visit ?? null);
});

visitsRouter.get("/", async (req, res) => {
  const { from, to, locationId } = req.query;
  const visits = await prisma.visit.findMany({
    where: {
      ...(from || to
        ? {
            startTime: {
              ...(from ? { gte: new Date(String(from)) } : {}),
              ...(to ? { lte: new Date(String(to)) } : {}),
            },
          }
        : {}),
      ...(locationId ? { locationId: Number(locationId) } : {}),
    },
    include: { tickets: true, location: true, mileage: true },
    orderBy: { startTime: "desc" },
  });
  res.json(visits);
});

visitsRouter.get("/:id", async (req, res) => {
  const visit = await prisma.visit.findUnique({
    where: { id: Number(req.params.id) },
    include: { tickets: true, location: true, mileage: true },
  });
  if (!visit) return res.status(404).json({ error: "Visit not found" });
  res.json(visit);
});

visitsRouter.post("/start", async (req, res) => {
  const { locationId, tickets, clientId, startTime } = req.body ?? {};
  if (!locationId) return res.status(400).json({ error: "locationId is required" });
  try {
    const visit = await startVisit({
      locationId: Number(locationId),
      tickets: Array.isArray(tickets) ? tickets : undefined,
      clientId,
      startTime: startTime ? new Date(startTime) : undefined,
    });
    res.status(201).json(visit);
  } catch (err) {
    if (err instanceof VisitError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to start visit" });
  }
});

visitsRouter.post("/:id/end", async (req, res) => {
  const { endTime } = req.body ?? {};
  try {
    const visit = await endVisit(Number(req.params.id), endTime ? new Date(endTime) : undefined);
    res.json(visit);
  } catch (err) {
    if (err instanceof VisitError) return res.status(409).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: "Failed to end visit" });
  }
});

visitsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { startTime, endTime, locationId, notes } = req.body ?? {};
  try {
    const existing = await prisma.visit.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: "Visit not found" });

    const data: any = {};
    if (startTime !== undefined) data.startTime = new Date(startTime);
    if (endTime !== undefined) data.endTime = endTime ? new Date(endTime) : null;
    if (locationId !== undefined) {
      const loc = await prisma.location.findUnique({ where: { id: Number(locationId) } });
      if (!loc) return res.status(400).json({ error: "Location not found" });
      data.locationId = Number(locationId);
    }
    if (notes !== undefined) data.notes = notes;

    // Recompute duration whenever either time changes
    const newStart = data.startTime ?? existing.startTime;
    const newEnd = data.endTime !== undefined ? data.endTime : existing.endTime;
    if (newEnd) {
      data.durationMinutes = Math.max(0, Math.round((newEnd.getTime() - newStart.getTime()) / 60000));
    } else {
      data.durationMinutes = null;
    }

    const visit = await prisma.visit.update({
      where: { id },
      data,
      include: { tickets: true, location: true, mileage: true },
    });
    res.json(visit);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update visit" });
  }
});

visitsRouter.put("/:id/notes", async (req, res) => {
  const { notes } = req.body ?? {};
  const visit = await prisma.visit.update({
    where: { id: Number(req.params.id) },
    data: { notes },
  });
  res.json(visit);
});

visitsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Tickets and the mileage record tied to this visit are removed automatically
    // (ON DELETE CASCADE in the schema) - this does not affect other visits' mileage.
    await prisma.visit.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: "Visit not found" });
  }
});

// Tickets nested under a visit
// Tickets nested under a visit
visitsRouter.post("/:id/tickets", async (req, res) => {
  const { ticketNumber } = req.body ?? {};
  if (!ticketNumber) return res.status(400).json({ error: "ticketNumber is required" });
  const ticket = await prisma.ticket.create({
    data: { visitId: Number(req.params.id), ticketNumber },
  });
  res.status(201).json(ticket);
});

visitsRouter.delete("/:id/tickets/:ticketId", async (req, res) => {
  await prisma.ticket.delete({ where: { id: Number(req.params.ticketId) } });
  res.json({ ok: true });
});
