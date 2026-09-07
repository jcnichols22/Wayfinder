import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "insecure-dev-secret-change-me";
const TOKEN_EXPIRY = "30d";

export interface TokenPayload {
  username: string;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Validates the submitted password against AUTH_PASSWORD_HASH (bcrypt hash, preferred)
 * or AUTH_PASSWORD (plain text fallback for quick local setup).
 */
export async function validatePassword(plainPassword: string): Promise<boolean> {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (hash) {
    return bcrypt.compare(plainPassword, hash);
  }
  const plain = process.env.AUTH_PASSWORD;
  if (plain) {
    return plainPassword === plain;
  }
  return false;
}

export function getConfiguredUsername(): string {
  return process.env.AUTH_USERNAME || "admin";
}
