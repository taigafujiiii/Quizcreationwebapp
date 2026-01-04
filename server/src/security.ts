import crypto from "crypto";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

export function hashToken(token: string) {
  const hash = crypto.createHash("sha256");
  hash.update(`${token}${config.tokenPepper}`);
  return hash.digest("hex");
}

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
