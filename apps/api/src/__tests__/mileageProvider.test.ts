import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { calculateMileage } from "../services/mileageProvider";

describe("mileageProvider", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.ORS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.MAPQUEST_API_KEY;
    delete process.env.MILEAGE_PROVIDER;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("falls back to an estimated 0-mile manual entry when no API key is configured", async () => {
    const result = await calculateMileage("275 Beatty Dr", "3715 Union Road");
    expect(result.estimated).toBe(true);
    expect(result.distanceMiles).toBe(0);
    expect(result.provider).toBe("none");
  });

  it("falls back gracefully when a provider is selected but its key is missing", async () => {
    process.env.MILEAGE_PROVIDER = "google";
    const result = await calculateMileage("275 Beatty Dr", "3715 Union Road");
    expect(result.estimated).toBe(true);
    expect(result.distanceMiles).toBe(0);
  });
});
