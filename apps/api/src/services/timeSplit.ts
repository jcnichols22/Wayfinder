export interface TimeVisit {
  startTime: Date;
  endTime: Date | null;
  durationMinutes: number | null;
  isOffice: boolean; // true when the visit's location is flagged as the office
}

export interface TimeSplit {
  /** Minutes at non-office (incident) locations. */
  workingMinutes: number;
  /** Minutes at office/admin locations. */
  adminMinutes: number;
  /** Measured minutes driving: same-day gaps between the end of one visit and the start of the next. */
  driveMinutes: number;
  /** Drive minutes that preceded each visit, aligned with the input array order (0 when unknown/cross-day). */
  perVisitDriveMinutes: number[];
}

/**
 * Splits a CHRONOLOGICALLY-SORTED (by startTime ascending) list of visits into:
 *  - working time: non-office visits ("time on incidents")
 *  - admin time: visits at office-flagged locations (commutes get bracketed by these)
 *  - drive time: the measured same-day gap between consecutive visits.
 *
 * Drive time is deliberately *measured* from the actual gap between an ended visit and
 * the next started visit — it reflects real traffic/wrecks — rather than a provider's
 * route-time estimate. Gaps spanning midnight (end of one day → first visit next day)
 * are excluded so overnight idle isn't miscounted as driving.
 */
export function splitTime(visits: TimeVisit[]): TimeSplit {
  let workingMinutes = 0;
  let adminMinutes = 0;
  let driveMinutes = 0;
  const perVisitDriveMinutes: number[] = [];
  let prevEnd: Date | null = null;
  let prevDay: string | null = null;

  for (const v of visits) {
    const dur = v.durationMinutes ?? 0;
    if (v.isOffice) adminMinutes += dur;
    else workingMinutes += dur;

    const day = v.startTime.toISOString().slice(0, 10);
    let driveToThis = 0;
    if (prevEnd && prevDay === day) {
      const gapMin = (v.startTime.getTime() - prevEnd.getTime()) / 60000;
      if (gapMin > 0) {
        driveToThis = Math.round(gapMin);
        driveMinutes += driveToThis;
      }
    }
    perVisitDriveMinutes.push(driveToThis);

    // Only a visit that has ended can bracket the drive out of it.
    if (v.endTime) {
      prevEnd = v.endTime;
      prevDay = day;
    } else {
      prevEnd = null;
      prevDay = null;
    }
  }

  return { workingMinutes, adminMinutes, driveMinutes, perVisitDriveMinutes };
}