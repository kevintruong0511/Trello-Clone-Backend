import type { Request, Response } from "express";
import * as boardService from "../services/board.service.js";
import { emitToBoard } from "../sockets/index.js";
import { logAudit } from "../services/audit.service.js";

export const create = async (req: Request, res: Response) => {
  const board = await boardService.createBoard(req.user!.id, req.body);
  res.status(201).json(board);
};

export const list = async (req: Request, res: Response) => {
  res.json(await boardService.listMyBoards(req.user!.id));
};

export const detail = async (req: Request, res: Response) => {
  res.json(await boardService.getBoardDetail(req.boardContext!.boardId));
};

export const update = async (req: Request, res: Response) => {
  const board = await boardService.updateBoard(req.boardContext!.boardId, req.body);
  emitToBoard(board.id, "board:updated", board);
  res.json(board);
};

export const remove = async (req: Request, res: Response) => {
  const boardId = req.params.id;
  await boardService.deleteBoard(boardId, req.user!.id);
  await logAudit({
    actorId: req.user!.id,
    targetId: boardId,
    action: "board.deleted",
    ip: req.ip,
  });
  emitToBoard(boardId, "board:deleted", { boardId });
  res.json({ ok: true });
};

export const invite = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  const member = await boardService.inviteMember(
    boardId,
    req.user!.id,
    req.body.email,
    req.body.role,
  );
  emitToBoard(boardId, "member:added", member);
  res.status(201).json(member);
};

export const updateMember = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  const member = await boardService.updateMemberRole(
    boardId,
    req.params.userId,
    req.body.role,
  );
  emitToBoard(boardId, "member:updated", member);
  res.json(member);
};

export const removeMember = async (req: Request, res: Response) => {
  const boardId = req.boardContext!.boardId;
  await boardService.removeMember(boardId, req.params.userId);
  emitToBoard(boardId, "member:removed", { userId: req.params.userId });
  res.json({ ok: true });
};
