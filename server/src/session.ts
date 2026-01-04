import jwt from "jsonwebtoken";
import { config } from "./config.js";

export type SessionPayload = {
  sub: string;
  role: "ADMIN" | "USER";
};

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, config.jwtSecret, {
    issuer: config.jwtIssuer,
    expiresIn: `${config.sessionTtlHours}h`,
  });
}

export function verifySession(token: string) {
  return jwt.verify(token, config.jwtSecret, {
    issuer: config.jwtIssuer,
  }) as SessionPayload & { iat: number; exp: number };
}
