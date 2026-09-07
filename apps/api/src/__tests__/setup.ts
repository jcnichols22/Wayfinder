import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { beforeAll, beforeEach, afterAll } from "vitest";

const testDbPath = path.join(__dirname, "test.db");
process.env.DATABASE_URL = `file:${testDbPath}`;
process.env.JWT_SECRET = "test-secret";
process.env.AUTH_USERNAME = "admin";
process.env.AUTH_PASSWORD = "test-password";

beforeAll(() => {
  if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
  execSync("npx prisma db push --skip-generate", {
    cwd: path.join(__dirname, "../../"),
    stdio: "inherit",
    env: process.env,
  });
});

beforeEach(async () => {
  const { prisma } = await import("../lib/prisma");
  await prisma.ticket.deleteMany();
  await prisma.mileage.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.location.deleteMany();
});

afterAll(async () => {
  const { prisma } = await import("../lib/prisma");
  await prisma.$disconnect();
  if (fs.existsSync(testDbPath)) fs.rmSync(testDbPath);
});
