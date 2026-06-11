import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { redis } from "../config/redis.js";
import { HttpError } from "../utils/httpError.js";
import { logAudit } from "../services/audit.service.js";

const PERM_CACHE_TTL = 300;

export const getUserPermissions = async (userId: string): Promise<string[]> => {
  const cacheKey = `perms:${userId}`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const rows = await prisma.$queryRaw<{ key: string }[]>`
    SELECT DISTINCT p.key
    FROM permissions p
    JOIN role_permissions rp ON rp.permission_id = p.id
    JOIN user_roles ur ON ur.role_id = rp.role_id
    WHERE ur.user_id = ${userId}::uuid
  `;
  const perms = rows.map((r) => r.key);
  await redis.set(cacheKey, JSON.stringify(perms), "EX", PERM_CACHE_TTL);
  return perms;
};

export const invalidatePermissions = (userId: string) => redis.del(`perms:${userId}`);

export const authorize =
  (requiredPermission: string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "UNAUTHENTICATED");

      const perms = await getUserPermissions(user.id);
      if (!perms.includes(requiredPermission)) {
        await logAudit({
          actorId: user.id,
          action: "permission.checked.denied",
          metadata: { permission: requiredPermission, path: req.path },
          ip: req.ip,
        });
        throw new HttpError(403, "FORBIDDEN", `Missing permission: ${requiredPermission}`);
      }
      next();
    } catch (e) {
      next(e);
    }
  };

const BOARD_ROLE_RANK = { viewer: 1, member: 2, owner: 3 } as const;
export type MinBoardRole = keyof typeof BOARD_ROLE_RANK;

export const isPlatformAdmin = async (userId: string) =>
  (await getUserPermissions(userId)).includes("boards.delete_any");

/** Requires req.params to carry boardId (or resolveBoardId to derive it). */
export const boardRole =
  (minRole: MinBoardRole, resolveBoardId?: (req: Request) => Promise<string | null>) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) throw new HttpError(401, "UNAUTHENTICATED");

      const boardId = resolveBoardId
        ? await resolveBoardId(req)
        : (req.params.boardId ?? req.params.id);
      if (!boardId) throw new HttpError(404, "BOARD_NOT_FOUND");

      if (await isPlatformAdmin(user.id)) {
        req.boardContext = { boardId, role: "owner", viaAdmin: true };
        return next();
      }

      const membership = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: user.id } },
      });
      if (!membership || BOARD_ROLE_RANK[membership.role] < BOARD_ROLE_RANK[minRole]) {
        await logAudit({
          actorId: user.id,
          targetId: boardId,
          action: "permission.checked.denied",
          metadata: { boardRole: minRole, path: req.path },
          ip: req.ip,
        });
        throw new HttpError(403, "FORBIDDEN", `Requires board role: ${minRole}`);
      }
      req.boardContext = { boardId, role: membership.role, viaAdmin: false };
      next();
    } catch (e) {
      next(e);
    }
  };

declare global {
  namespace Express {
    interface Request {
      boardContext?: { boardId: string; role: "owner" | "member" | "viewer"; viaAdmin: boolean };
    }
  }
}
