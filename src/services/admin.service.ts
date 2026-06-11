import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { invalidatePermissions } from "../middlewares/rbac.js";

export const listUsers = async (search?: string, page = 1, pageSize = 20) => {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        roles: { select: { role: { select: { key: true } } } },
      },
    }),
    prisma.user.count({ where }),
  ]);
  return {
    total,
    users: users.map((u) => ({ ...u, roles: u.roles.map((r) => r.role.key) })),
  };
};

export const setUserRole = async (
  actorId: string,
  targetId: string,
  roleKey: "admin" | "user",
) => {
  if (actorId === targetId) throw new HttpError(400, "CANNOT_CHANGE_OWN_ROLE");
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { key: "admin" } });

  if (roleKey === "admin") {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetId, roleId: adminRole.id } },
      update: {},
      create: { userId: targetId, roleId: adminRole.id, grantedBy: actorId },
    });
  } else {
    await prisma.userRole.deleteMany({
      where: { userId: targetId, roleId: adminRole.id },
    });
  }
  await invalidatePermissions(targetId);
};

export const setUserBan = async (actorId: string, targetId: string, banned: boolean) => {
  if (actorId === targetId) throw new HttpError(400, "CANNOT_BAN_SELF");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: targetId },
      data: {
        status: banned ? "banned" : "active",
        tokenVersion: { increment: banned ? 1 : 0 },
      },
    }),
    ...(banned
      ? [prisma.refreshToken.deleteMany({ where: { userId: targetId } })]
      : []),
  ]);
};

export const deleteUser = async (actorId: string, targetId: string) => {
  if (actorId === targetId) throw new HttpError(400, "CANNOT_DELETE_SELF");
  await prisma.user.delete({ where: { id: targetId } });
};

export const listAllBoards = (page = 1, pageSize = 20) =>
  prisma.$transaction([
    prisma.board.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, cards: true } },
      },
    }),
    prisma.board.count(),
  ]);

export const getStats = async () => {
  const [users, boards, cards, activeUsers] = await prisma.$transaction([
    prisma.user.count(),
    prisma.board.count(),
    prisma.card.count(),
    prisma.user.count({ where: { status: "active" } }),
  ]);
  return { users, activeUsers, boards, cards };
};

export const getActivity = (page = 1, pageSize = 50) =>
  prisma.accessAudit.findMany({
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: "desc" },
  });
