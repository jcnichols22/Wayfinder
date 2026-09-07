import { describe, it, expect } from "vitest";
import { prisma } from "../lib/prisma";
import { startVisit } from "../services/visitService";

describe("tickets", () => {
  it("allows adding multiple tickets to one visit", async () => {
    const loc = await prisma.location.create({ data: { name: "Olin", address: "309 Olin Way" } });
    const visit = await startVisit({ locationId: loc.id, tickets: ["INC1453201"] });

    await prisma.ticket.create({ data: { visitId: visit.id, ticketNumber: "SCTASK0557608" } });
    await prisma.ticket.create({ data: { visitId: visit.id, ticketNumber: "SCTASK0557698" } });

    const tickets = await prisma.ticket.findMany({ where: { visitId: visit.id } });
    expect(tickets).toHaveLength(3);
    expect(tickets.map((t: { ticketNumber: string }) => t.ticketNumber)).toEqual(
      expect.arrayContaining(["INC1453201", "SCTASK0557608", "SCTASK0557698"])
    );
  });
});
