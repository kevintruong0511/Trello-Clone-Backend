import bcrypt from "bcrypt";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from "../utils/tokens.js";
import { logAudit } from "./audit.service.js";

const issueTokenPair = async (userId: string, tokenVersion: number) => {
  const { token: accessToken } = signAccessToken(userId, tokenVersion);
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashRefreshToken(refreshToken),
      jti: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + env.refreshTokenTtlSec * 1000),
    },
  });
  return { accessToken, refreshToken };
};

export const register = async (name: string, email: string, password: string) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, "EMAIL_TAKEN", "Email already registered");

  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = await prisma.role.findUniqueOrThrow({ where: { key: "user" } });
  const user = await prisma.user.create({
    data: { name, email, passwordHash, roles: { create: { roleId: userRole.id } } },
  });
  return issueTokenPairWithUser(user.id, user.tokenVersion);
};

const issueTokenPairWithUser = async (userId: string, tokenVersion: number) => {
  const pair = await issueTokenPair(userId, tokenVersion);
  return { userId, ...pair };
};

export const login = async (email: string, password: string, ip?: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) {
    await logAudit({ action: "auth.login.failed", metadata: { email }, ip });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Wrong email or password");
  }
  if (user.status === "banned") {
    await logAudit({ actorId: user.id, action: "auth.login.banned", ip });
    throw new HttpError(403, "BANNED", "Account is banned");
  }
  await logAudit({ actorId: user.id, action: "auth.login.success", ip });
  return issueTokenPairWithUser(user.id, user.tokenVersion);
};

export const renew = async (refreshToken: string, ip?: string) => {
  const tokenHash = hashRefreshToken(refreshToken);
  const record = await prisma.refreshToken.findFirst({ where: { tokenHash } });

  if (!record || record.expiresAt < new Date()) {
    throw new HttpError(401, "INVALID_REFRESH", "Refresh token invalid or expired");
  }

  if (record.used) {
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
      prisma.user.update({
        where: { id: record.userId },
        data: { tokenVersion: { increment: 1 } },
      }),
    ]);
    await logAudit({
      actorId: record.userId,
      action: "auth.refresh.reuse_detected",
      ip,
    });
    throw new HttpError(401, "REFRESH_REUSED", "Token reuse detected, all sessions revoked");
  }

  await prisma.refreshToken.update({ where: { id: record.id }, data: { used: true } });
  const user = await prisma.user.findUniqueOrThrow({ where: { id: record.userId } });
  if (user.status === "banned") throw new HttpError(403, "BANNED", "Account is banned");
  return issueTokenPairWithUser(user.id, user.tokenVersion);
};

export const logout = async (
  jti: string | undefined,
  exp: number | undefined,
  refreshToken: string | undefined,
) => {
  if (jti && exp) {
    const ttl = exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) await redis.set(`revoked_jti:${jti}`, "1", "EX", ttl);
  }
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: hashRefreshToken(refreshToken) },
    });
  }
};

export const logoutAll = async (userId: string) => {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
  await redis.del(`perms:${userId}`);
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      status: true,
      createdAt: true,
      roles: {
        select: {
          role: {
            select: {
              key: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  const roles = user.roles.map((r) => r.role.key);
  const permissions = [
    ...new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.key))),
  ];
  const { roles: _, ...profile } = user;
  return { ...profile, roles, permissions };
};
