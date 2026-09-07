import { Router } from "express";
import { getConfiguredUsername, signToken, validatePassword } from "../lib/auth";
import { requireAuth, AuthedRequest } from "../middleware/requireAuth";

export const authRouter = Router();

const isProd = process.env.NODE_ENV === "production" && process.env.FORCE_SECURE_COOKIE !== "false";

authRouter.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const expectedUsername = getConfiguredUsername();
  if (username !== expectedUsername) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const valid = await validatePassword(password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({ username });
  res.cookie("token", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({ username, token });
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  res.json({ username: req.user?.username });
});
