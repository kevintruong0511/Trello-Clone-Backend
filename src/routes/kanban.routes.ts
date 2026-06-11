import { Router } from "express";
import * as kanban from "../controllers/kanban.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { boardRole } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { boardIdOfCard, boardIdOfColumn } from "../services/kanban.service.js";
import {
  updateColumnSchema,
  createCardSchema,
  updateCardSchema,
  createCommentSchema,
} from "../validations/board.validation.js";

const viaColumn = (req: { params: Record<string, string> }) =>
  boardIdOfColumn(req.params.columnId ?? req.params.id);
const viaCard = (req: { params: Record<string, string> }) => boardIdOfCard(req.params.id);

export const columnRoutes = Router();
columnRoutes.use(authenticate);
columnRoutes.put(
  "/:id",
  boardRole("member", viaColumn),
  validate(updateColumnSchema),
  asyncHandler(kanban.updateColumn),
);
columnRoutes.delete("/:id", boardRole("member", viaColumn), asyncHandler(kanban.deleteColumn));
columnRoutes.post(
  "/:columnId/cards",
  boardRole("member", viaColumn),
  validate(createCardSchema),
  asyncHandler(kanban.createCard),
);

export const cardRoutes = Router();
cardRoutes.use(authenticate);
cardRoutes.get("/:id", boardRole("viewer", viaCard), asyncHandler(kanban.getCard));
cardRoutes.put(
  "/:id",
  boardRole("member", viaCard),
  validate(updateCardSchema),
  asyncHandler(kanban.updateCard),
);
cardRoutes.delete("/:id", boardRole("member", viaCard), asyncHandler(kanban.deleteCard));
cardRoutes.post(
  "/:id/comments",
  boardRole("member", viaCard),
  validate(createCommentSchema),
  asyncHandler(kanban.addComment),
);
