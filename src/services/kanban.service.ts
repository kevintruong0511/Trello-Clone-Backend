import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/httpError.js";
import { nextPosition } from "../utils/positions.js";

export const boardIdOfColumn = async (columnId: string) => {
  const col = await prisma.column.findUnique({
    where: { id: columnId },
    select: { boardId: true },
  });
  return col?.boardId ?? null;
};

export const boardIdOfCard = async (cardId: string) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: { boardId: true },
  });
  return card?.boardId ?? null;
};

export const createColumn = async (boardId: string, userId: string, title: string) => {
  const max = await prisma.column.aggregate({
    where: { boardId },
    _max: { position: true },
  });
  const [column] = await prisma.$transaction([
    prisma.column.create({
      data: { boardId, title, position: nextPosition(max._max.position) },
    }),
    prisma.activity.create({
      data: { boardId, userId, action: "created_column", meta: { title } },
    }),
  ]);
  return column;
};

export const updateColumn = (columnId: string, data: { title?: string; position?: number }) =>
  prisma.column.update({ where: { id: columnId }, data });

export const deleteColumn = (columnId: string) =>
  prisma.column.delete({ where: { id: columnId } });

const cardInclude = {
  labels: { select: { labelId: true } },
  assignees: { select: { userId: true } },
  _count: { select: { comments: true, checklists: true } },
} as const;

export const createCard = async (columnId: string, userId: string, title: string) => {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) throw new HttpError(404, "COLUMN_NOT_FOUND");
  const max = await prisma.card.aggregate({
    where: { columnId },
    _max: { position: true },
  });
  const [card] = await prisma.$transaction([
    prisma.card.create({
      data: {
        columnId,
        boardId: column.boardId,
        title,
        position: nextPosition(max._max.position),
      },
      include: cardInclude,
    }),
    prisma.activity.create({
      data: { boardId: column.boardId, userId, action: "created_card", meta: { title } },
    }),
  ]);
  return card;
};

export const getCard = async (cardId: string) => {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: { select: { labelId: true } },
      assignees: {
        select: { user: { select: { id: true, name: true, email: true, avatar: true } } },
      },
      checklists: {
        orderBy: { position: "asc" },
        include: { items: { orderBy: { position: "asc" } } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true, avatar: true } } },
      },
    },
  });
  if (!card) throw new HttpError(404, "CARD_NOT_FOUND");
  return card;
};

export const updateCard = async (
  cardId: string,
  userId: string,
  data: {
    title?: string;
    description?: string | null;
    columnId?: string;
    position?: number;
    dueDate?: Date | null;
    dueComplete?: boolean;
    cover?: string | null;
    isArchived?: boolean;
  },
) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new HttpError(404, "CARD_NOT_FOUND");

  if (data.columnId && data.columnId !== card.columnId) {
    const target = await prisma.column.findUnique({ where: { id: data.columnId } });
    if (!target || target.boardId !== card.boardId) {
      throw new HttpError(400, "INVALID_COLUMN", "Target column not on this board");
    }
    await prisma.activity.create({
      data: { boardId: card.boardId, cardId, userId, action: "moved_card" },
    });
  }

  return prisma.card.update({
    where: { id: cardId },
    data,
    include: {
      labels: { select: { labelId: true } },
      assignees: { select: { userId: true } },
      _count: { select: { comments: true, checklists: true } },
    },
  });
};

export const deleteCard = (cardId: string) => prisma.card.delete({ where: { id: cardId } });

export const addComment = async (cardId: string, userId: string, text: string) => {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) throw new HttpError(404, "CARD_NOT_FOUND");
  const [comment] = await prisma.$transaction([
    prisma.comment.create({
      data: { cardId, userId, text },
      include: { user: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.activity.create({
      data: { boardId: card.boardId, cardId, userId, action: "commented" },
    }),
  ]);
  return comment;
};
