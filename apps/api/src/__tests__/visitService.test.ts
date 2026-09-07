import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "../lib/prisma";
import { startVisit, endVisit, VisitError } from "../services/visitService";

async function createLocation(name: string, address: string) {
  return prisma.location.create({ data: { name, address } });
}

describe("visitService", () => {
  it("starts a visit with tickets", async () => {
    const loc = await createLocation("Beatty", "275 Beatty Dr");
    const visit = await startVisit({ locationId: loc.id, tickets: ["INC1453201", "SCTASK0557608"] });
    expect(visit.locationId).toBe(loc.id);
    expect(visit.endTime).toBeNull();
    expect(visit.tickets).toHaveLength(2);
  });

  it("prevents starting a second visit while one is active", async () => {
    const loc = await createLocation("Beatty", "275 Beatty Dr");
    await startVisit({ locationId: loc.id });
    await expect(startVisit({ locationId: loc.id })).rejects.toThrow(VisitError);
  });

  it("ends a visit and calculates duration in minutes", async () => {
    const loc = await createLocation("Beatty", "275 Beatty Dr");
    const start = new Date("2026-01-01T09:00:00Z");
    const end = new Date("2026-01-01T10:30:00Z");
    const visit = await startVisit({ locationId: loc.id, startTime: start });
    const ended = await endVisit(visit.id, end);
    expect(ended.durationMinutes).toBe(90);
    expect(ended.endTime?.toISOString()).toBe(end.toISOString());
  });

  it("rejects ending a visit twice", async () => {
    const loc = await createLocation("Beatty", "275 Beatty Dr");
    const visit = await startVisit({ locationId: loc.id });
    await endVisit(visit.id, new Date());
    await expect(endVisit(visit.id, new Date())).rejects.toThrow(VisitError);
  });

  it("creates an automatic mileage record when moving between locations", async () => {
    const beatty = await createLocation("Beatty", "275 Beatty Dr");
    const union = await createLocation("Union", "3715 Union Road");

    const first = await startVisit({ locationId: beatty.id, startTime: new Date("2026-01-01T08:00:00Z") });
    await endVisit(first.id, new Date("2026-01-01T09:00:00Z"));

    const second = await startVisit({ locationId: union.id, startTime: new Date("2026-01-01T10:00:00Z") });

    const mileage = await prisma.mileage.findUnique({ where: { visitId: second.id } });
    expect(mileage).not.toBeNull();
    expect(mileage?.fromLocationName).toBe("Beatty");
    expect(mileage?.toLocationName).toBe("Union");
    // No API key configured in tests -> falls back to manual/estimated 0 miles
    expect(mileage?.estimated).toBe(true);
  });

  it("does not create a mileage record when staying at the same location", async () => {
    const beatty = await createLocation("Beatty", "275 Beatty Dr");
    const first = await startVisit({ locationId: beatty.id, startTime: new Date("2026-01-01T08:00:00Z") });
    await endVisit(first.id, new Date("2026-01-01T09:00:00Z"));
    const second = await startVisit({ locationId: beatty.id, startTime: new Date("2026-01-01T10:00:00Z") });

    const mileage = await prisma.mileage.findUnique({ where: { visitId: second.id } });
    expect(mileage).toBeNull();
  });
});
