interface VisitRow {
  date: string;
  location: string;
  start: string;
  end: string;
  durationMinutes: number | null;
  durationFormatted: string;
  tickets: string;
  mileage: number;
  notes: string;
}

function csvEscape(value: string | number): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

export function buildVisitsCsv(rows: VisitRow[]): string {
  const header = [
    "Date",
    "Location",
    "Start",
    "End",
    "Duration Minutes",
    "Duration Formatted",
    "Tickets",
    "Mileage",
    "Notes",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.date),
        csvEscape(row.location),
        csvEscape(row.start),
        csvEscape(row.end),
        csvEscape(row.durationMinutes ?? ""),
        csvEscape(row.durationFormatted),
        csvEscape(row.tickets),
        csvEscape(row.mileage),
        csvEscape(row.notes),
      ].join(",")
    );
  }
  return lines.join("\n");
}
