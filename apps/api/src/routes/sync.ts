import { Router } from "express";
import { prisma } from "../lib/prisma";
import { startVisit, endVisit, VisitError } from "../services/visitService";

export const syncRouter = Router();

/**
 * Accepts a batch of offline-queued actions from the PWA and applies them in order.
 * Each action: { type: 'start_visit' | 'end_visit' | 'add_ticket', clientId, payload }
 * Uses clientId for idempotency so retried syncs don't create duplicate visits.
 */
syncRouter.post("/", async (req, res) => {
  const { actions } = req.body ?? {};
  if (!Array.isArray(actions)) {
    return res.status(400).json({ error: "actions array is required" });
  }

  const results: any[] = [];

  for (const action of actions) {
    try {
      if (action.type === "start_visit") {
        if (action.clientId) {
          const existing = await prisma.visit.findUnique({ where: { clientId: action.clientId } });
          if (existing) {
            results.push({ clientId: action.clientId, status: "already_synced", visitId: existing.id });
            continue;
          }
        }
        const visit = await startVisit({
          locationId: action.payload.locationId,
          tickets: action.payload.tickets,
          clientId: action.clientId,
          startTime: action.payload.startTime ? new Date(action.payload.startTime) : undefined,
        });
        results.push({ clientId: action.clientId, status: "synced", visitId: visit.id });
      } else if (action.type === "end_visit") {
        // visitId may be a real numeric id, or a reference to the offline-created visit's
        // clientId (when the visit itself hasn't synced yet within this same batch/session).
        let visitId: number | undefined = action.payload.visitId;
        if (!visitId && action.payload.startClientId) {
          const started = await prisma.visit.findUnique({
            where: { clientId: action.payload.startClientId },
          });
          visitId = started?.id;
        }
        if (!visitId) throw new VisitError("Could not resolve visit to end");
        const visit = await endVisit(
          visitId,
          action.payload.endTime ? new Date(action.payload.endTime) : undefined
        );
        results.push({ clientId: action.clientId, status: "synced", visitId: visit.id });
      } else if (action.type === "add_ticket") {
        let visitId: number | undefined = action.payload.visitId;
        if (!visitId && action.payload.startClientId) {
          const started = await prisma.visit.findUnique({
            where: { clientId: action.payload.startClientId },
          });
          visitId = started?.id;
        }
        if (!visitId) throw new VisitError("Could not resolve visit for ticket");
        const ticket = await prisma.ticket.create({
          data: { visitId, ticketNumber: action.payload.ticketNumber },
        });
        results.push({ clientId: action.clientId, status: "synced", ticketId: ticket.id });
      } else {
        results.push({ clientId: action.clientId, status: "error", error: "Unknown action type" });
      }
    } catch (err) {
      const message = err instanceof VisitError ? err.message : "Failed to apply action";
      results.push({ clientId: action.clientId, status: "error", error: message });
    }
  }

  res.json({ results });
});
