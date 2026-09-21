import { Router } from "express";
import { prisma } from "../lib/prisma";

export const locationsRouter = Router();

locationsRouter.get("/", async (req, res) => {
  const includeInactive = req.query.includeInactive === "true";
  const locations = await prisma.location.findMany({
    where: includeInactive ? undefined : { active: true },
    orderBy: [{ favorite: "desc" }, { name: "asc" }],
  });
  res.json(locations);
});

locationsRouter.post("/", async (req, res) => {
  const { name, address, favorite, isOffice } = req.body ?? {};
  if (!name || !address) {
    return res.status(400).json({ error: "name and address are required" });
  }
  const location = await prisma.location.create({
    data: { name, address, favorite: Boolean(favorite), isOffice: Boolean(isOffice) },
  });
  res.status(201).json(location);
});

locationsRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, address, active, favorite, isOffice } = req.body ?? {};
  try {
    const location = await prisma.location.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(address !== undefined && { address }),
        ...(active !== undefined && { active }),
        ...(favorite !== undefined && { favorite }),
        ...(isOffice !== undefined && { isOffice }),
      },
    });
    res.json(location);
  } catch {
    res.status(404).json({ error: "Location not found" });
  }
});

locationsRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    // Soft delete: deactivate instead of destroying history-linked rows
    const location = await prisma.location.update({ where: { id }, data: { active: false } });
    res.json(location);
  } catch {
    res.status(404).json({ error: "Location not found" });
  }
});

// Permanent delete - only allowed if the location has never had a visit recorded.
// Locations with history should be deactivated instead (DELETE /:id above) to preserve reports.
locationsRouter.delete("/:id/permanent", async (req, res) => {
  const id = Number(req.params.id);

  const location = await prisma.location.findUnique({ where: { id } });
  if (!location) return res.status(404).json({ error: "Location not found" });

  const visitCount = await prisma.visit.count({ where: { locationId: id } });
  if (visitCount > 0) {
    return res.status(409).json({
      error: `This location has ${visitCount} visit(s) on record and can't be permanently deleted. Deactivate it instead to hide it without losing history.`,
    });
  }

  await prisma.location.delete({ where: { id } });
  res.json({ ok: true });
});