import { describe, it, expect } from "vitest";
import { api } from "../lib/api";

describe("api.exportCsvUrl", () => {
  it("builds a daily export URL with the date param", () => {
    const url = api.exportCsvUrl("daily", { date: "2026-01-15" });
    expect(url).toBe("/api/reports/export/csv?range=daily&date=2026-01-15");
  });

  it("builds a monthly export URL", () => {
    const url = api.exportCsvUrl("monthly", { date: "2026-02-01" });
    expect(url).toContain("range=monthly");
    expect(url).toContain("date=2026-02-01");
  });

  it("builds a custom range export URL with from/to", () => {
    const url = api.exportCsvUrl("custom", { from: "2026-01-01", to: "2026-01-31" });
    expect(url).toContain("from=2026-01-01");
    expect(url).toContain("to=2026-01-31");
  });
});
