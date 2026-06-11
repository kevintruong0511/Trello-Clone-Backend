import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { isPlatformAdmin } from "../middlewares/rbac.js";

const memberSelect = {
  userId: true,
  role: true,
  user: { select: { id: true, name: true, email: true, avatar: true } },
} as const;

export const getDefaultWorkspace = async (userId: string) => {
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  return prisma.workspace.create({
    data: {
      name: "Personal",
      ownerId: userId,
      members: { create: { userId, role: "admin" } },
    },
  });
};

export const createBoard = async (
  userId: string,
  data: {
    title: string;
    description?: string;
    workspaceId?: string;
    background?: string;
    visibility?: "private" | "workspace";
  },
) => {
  const workspaceId = data.workspaceId ?? (await getDefaultWorkspace(userId)).id;
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: { members: { where: { userId } } },
  });
  if (!ws) throw new HttpError(404, "WORKSPACE_NOT_FOUND");
  if (ws.ownerId !== userId && ws.members.length === 0) {
    throw new HttpError(403, "FORBIDDEN", "Not a workspace member");
  }

  return prisma.board.create({
    data: {
      workspaceId,
      title: data.title,
      description: data.description,
      background: data.background,
      visibility: data.visibility ?? "private",
      ownerId: userId,
      members: { create: { userId, role: "owner" } },
      activities: { create: { userId, action: "created_board" } },
    },
    include: { members: { select: memberSelect } },
  });
};

export const listMyBoards = (userId: string) =>
  prisma.board.findMany({
    where: { members: { some: { userId } }, isClosed: false },
    orderBy: { updatedAt: "desc" },
    include: {
      members: { select: memberSelect },
      stars: { where: { userId }, select: { userId: true } },
    },
  });

export const getBoardDetail = async (boardId: string) => {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      members: { select: memberSelect },
      labels: true,
      columns: {
        orderBy: { position: "asc" },
        include: {
          cards: {
            where: { isArchived: false },
            orderBy: { position: "asc" },
            include: {
              labels: { select: { labelId: true } },
              assignees: { select: { userId: true } },
              _count: { select: { comments: true, checklists: true } },
            },
          },
        },
      },
    },
  });
  if (!board) throw new HttpError(404, "BOARD_NOT_FOUND");
  return board;
};

export const updateBoard = (boardId: string, data: object) =>
  prisma.board.update({ where: { id: boardId }, data });

export const deleteBoard = async (boardId: string, actorId: string) => {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) throw new HttpError(404, "BOARD_NOT_FOUND");
  if (board.ownerId !== actorId && !(await isPlatformAdmin(actorId))) {
    throw new HttpError(403, "FORBIDDEN", "Only owner or admin can delete a board");
  }
  await prisma.board.delete({ where: { id: boardId } });
};

export const inviteMember = async (
  boardId: string,
  actorId: string,
  email: string,
  role: "member" | "viewer",
) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(404, "USER_NOT_FOUND", "No account with that email");
  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: user.id } },
  });
  if (existing) throw new HttpError(409, "ALREADY_MEMBER");

  const [member] = await prisma.$transaction([
    prisma.boardMember.create({
      data: { boardId, userId: user.id, role },
      select: memberSelect,
    }),
    prisma.activity.create({
      data: { boardId, userId: actorId, action: "invited_member", meta: { email, role } },
    }),
    prisma.notification.create({
      data: {
        userId: user.id,
        type: "invite",
        message: `You were added to a board`,
        link: `/boards/${boardId}`,
      },
    }),
  ]);
  return member;
};

export const updateMemberRole = async (
  boardId: string,
  targetUserId: string,
  role: "owner" | "member" | "viewer",
) => {
  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId === targetUserId && role !== "owner") {
    throw new HttpError(400, "CANNOT_DEMOTE_OWNER", "Transfer ownership first");
  }
  return prisma.boardMember.update({
    where: { boardId_userId: { boardId, userId: targetUserId } },
    data: { role },
    select: memberSelect,
  });
};

export const removeMember = async (boardId: string, targetUserId: string) => {
  const board = await prisma.board.findUniqueOrThrow({ where: { id: boardId } });
  if (board.ownerId === targetUserId) {
    throw new HttpError(400, "CANNOT_REMOVE_OWNER");
  }
  await prisma.boardMember.delete({
    where: { boardId_userId: { boardId, userId: targetUserId } },
  });
};
