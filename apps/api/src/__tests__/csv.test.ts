import { describe, it, expect } from "vitest";
import { buildVisitsCsv, formatDuration } from "../services/csv";

describe("csv export", () => {
  it("formats duration as hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
    expect(formatDuration(0)).toBe("0h 0m");
    expect(formatDuration(null)).toBe("");
  });

  it("builds a CSV with the expected header and rows", () => {
    const csv = buildVisitsCsv([
      {
        date: "2026-01-01",
        location: "Beatty",
        start: "2026-01-01T09:00:00Z",
        end: "2026-01-01T10:30:00Z",
        durationMinutes: 90,
        durationFormatted: "1h 30m",
        tickets: "INC1453201; SCTASK0557608",
        mileage: 12.4,
        notes: "Replaced, switch",
      },
    ]);

    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "Date,Location,Start,End,Duration Minutes,Duration Formatted,Tickets,Mileage,Notes"
    );
    expect(lines[1]).toContain("Beatty");
    expect(lines[1]).toContain("1h 30m");
    // Notes containing a comma should be quoted
    expect(lines[1]).toContain('"Replaced, switch"');
  });
});
