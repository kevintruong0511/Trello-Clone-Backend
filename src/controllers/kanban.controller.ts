import type { Request, Response } from "express";
import * as kanban from "../services/kanban.service.js";
import { emitToBoard } from "../sockets/index.js";

export const createColumn = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  const column = await kanban.createColumn(boardId, req.user!.id, req.body.title);
  emitToBoard(boardId, "column:created", column);
  res.status(201).json(column);
};

export const updateColumn = async (req: Request, res: Response) => {
  const column = await kanban.updateColumn(req.params.id, req.body);
  emitToBoard(column.boardId, "column:updated", column);
  res.json(column);
};

export const deleteColumn = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  await kanban.deleteColumn(req.params.id);
  emitToBoard(boardId, "column:deleted", { columnId: req.params.id });
  res.json({ ok: true });
};

export const createCard = async (req: Request, res: Response) => {
  const card = await kanban.createCard(req.params.columnId, req.user!.id, req.body.title);
  emitToBoard(card.boardId, "card:created", card);
  res.status(201).json(card);
};

export const getCard = async (req: Request, res: Response) => {
  res.json(await kanban.getCard(req.params.id));
};

export const updateCard = async (req: Request, res: Response) => {
  const card = await kanban.updateCard(req.params.id, req.user!.id, req.body);
  emitToBoard(card.boardId, "card:updated", card);
  res.json(card);
};

export const deleteCard = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  await kanban.deleteCard(req.params.id);
  emitToBoard(boardId, "card:deleted", { cardId: req.params.id });
  res.json({ ok: true });
};

export const addComment = async (req: Request, res: Response) => {
  const comment = await kanban.addComment(req.params.id, req.user!.id, req.body.text);
  emitToBoard(req.boardContext!.boardId, "comment:added", {
    cardId: req.params.id,
    comment,
  });
  res.status(201).json(comment);
};
