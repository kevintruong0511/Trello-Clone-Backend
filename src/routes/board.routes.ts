import { Router } from "express";
import * as board from "../controllers/board.controller.js";
import * as kanban from "../controllers/kanban.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { boardRole } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  createBoardSchema,
  updateBoardSchema,
  inviteMemberSchema,
  updateMemberSchema,
  createColumnSchema,
} from "../validations/board.validation.js";

export const boardRoutes = Router();
boardRoutes.use(authenticate);

boardRoutes.post("/", validate(createBoardSchema), asyncHandler(board.create));
boardRoutes.get("/", asyncHandler(board.list));
boardRoutes.get("/:id", boardRole("viewer"), asyncHandler(board.detail));
boardRoutes.put("/:id", boardRole("owner"), validate(updateBoardSchema), asyncHandler(board.update));
boardRoutes.delete("/:id", asyncHandler(board.remove));

boardRoutes.post(
  "/:id/invite",
  boardRole("owner"),
  validate(inviteMemberSchema),
  asyncHandler(board.invite),
);
boardRoutes.put(
  "/:id/members/:userId",
  boardRole("owner"),
  validate(updateMemberSchema),
  asyncHandler(board.updateMember),
);
boardRoutes.delete("/:id/members/:userId", boardRole("owner"), asyncHandler(board.removeMember));

boardRoutes.post(
  "/:boardId/columns",
  boardRole("member"),
  validate(createColumnSchema),
  asyncHandler(kanban.createColumn),
);
