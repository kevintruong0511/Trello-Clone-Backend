import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { env } from "../config/env.js";

export interface AccessPayload {
  sub: string;
  tokenVersion: number;
  jti: string;
}

export const signAccessToken = (userId: string, tokenVersion: number) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign({ sub: userId, tokenVersion, jti }, env.jwtSecret, {
    expiresIn: env.accessTokenTtlSec,
  });
  return { token, jti };
};

export const verifyAccessToken = (token: string): AccessPayload & { exp: number } =>
  jwt.verify(token, env.jwtSecret) as AccessPayload & { exp: number };

export const generateRefreshToken = () => crypto.randomUUID();

export const hashRefreshToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
