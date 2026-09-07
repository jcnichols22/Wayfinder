import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth";
import { locationsRouter } from "./routes/locations";
import { visitsRouter } from "./routes/visits";
import { reportsRouter } from "./routes/reports";
import { syncRouter } from "./routes/sync";
import { planRouter } from "./routes/plan";
import { requireAuth } from "./middleware/requireAuth";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? true,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);

  // Everything below requires a valid session
  app.use("/api/locations", requireAuth, locationsRouter);
  app.use("/api/visits", requireAuth, visitsRouter);
  app.use("/api/reports", requireAuth, reportsRouter);
  app.use("/api/sync", requireAuth, syncRouter);
  app.use("/api/plan", requireAuth, planRouter);

  return app;
}
