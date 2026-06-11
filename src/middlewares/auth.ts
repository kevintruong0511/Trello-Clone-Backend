import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { verifyAccessToken } from "../utils/tokens.js";
import { HttpError } from "../utils/httpError.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; jti: string; exp: number };
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "UNAUTHENTICATED", "Missing access token");
    }
    let payload;
    try {
      payload = verifyAccessToken(header.slice(7));
    } catch (e: any) {
      const code = e?.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
      throw new HttpError(401, code);
    }

    const revoked = await redis.get(`revoked_jti:${payload.jti}`);
    if (revoked) throw new HttpError(401, "TOKEN_REVOKED");

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { tokenVersion: true, status: true },
    });
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      throw new HttpError(401, "TOKEN_STALE");
    }
    if (user.status === "banned") throw new HttpError(403, "BANNED");

    req.user = { id: payload.sub, jti: payload.jti, exp: payload.exp };
    next();
  } catch (e) {
    next(e);
  }
};
