import { prisma } from "../lib/prisma";
import { calculateMileage } from "./mileageProvider";

export class VisitError extends Error {}

/**
 * Starts a new visit at the given location. If there is a most-recent prior visit
 * (any location, already ended) that differs from the new location, automatically
 * creates a mileage record from that prior location to the new one.
 */
export async function startVisit(params: {
  locationId: number;
  tickets?: string[];
  clientId?: string;
  startTime?: Date;
}) {
  const activeVisit = await prisma.visit.findFirst({ where: { endTime: null } });
  if (activeVisit) {
    throw new VisitError("A visit is already active. End it before starting a new one.");
  }

  const location = await prisma.location.findUnique({ where: { id: params.locationId } });
  if (!location) {
    throw new VisitError("Location not found");
  }

  const startTime = params.startTime ?? new Date();

  const visit = await prisma.visit.create({
    data: {
      locationId: params.locationId,
      startTime,
      clientId: params.clientId,
      tickets: params.tickets?.length
        ? { create: params.tickets.map((t) => ({ ticketNumber: t })) }
        : undefined,
    },
    include: { tickets: true, location: true },
  });

  // Find the previous visit (most recent, ended, not this one) to compute mileage
  const previousVisit = await prisma.visit.findFirst({
    where: { id: { not: visit.id }, endTime: { not: null } },
    orderBy: { endTime: "desc" },
    include: { location: true },
  });

  if (previousVisit && previousVisit.locationId !== visit.locationId) {
    const result = await calculateMileage(previousVisit.location.address, location.address);
    await prisma.mileage.create({
      data: {
        visitId: visit.id,
        fromLocationId: previousVisit.locationId,
        toLocationId: visit.locationId,
        fromLocationName: previousVisit.location.name,
        toLocationName: location.name,
        distanceMiles: result.distanceMiles,
        estimated: result.estimated,
      },
    });
  }

  return visit;
}

export async function endVisit(visitId: number, endTime?: Date) {
  const visit = await prisma.visit.findUnique({ where: { id: visitId } });
  if (!visit) throw new VisitError("Visit not found");
  if (visit.endTime) throw new VisitError("Visit already ended");

  const end = endTime ?? new Date();
  const durationMinutes = Math.max(
    0,
    Math.round((end.getTime() - visit.startTime.getTime()) / 60000)
  );

  return prisma.visit.update({
    where: { id: visitId },
    data: { endTime: end, durationMinutes },
    include: { tickets: true, location: true, mileage: true },
  });
}
