import { Router } from "express";
import { z } from "zod";
import * as admin from "../services/admin.service.js";
import * as boardService from "../services/board.service.js";
import { authenticate } from "../middlewares/auth.js";
import { authorize } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logAudit } from "../services/audit.service.js";

export const adminRoutes = Router();
adminRoutes.use(authenticate);

adminRoutes.get(
  "/users",
  authorize("users.list"),
  asyncHandler(async (req, res) => {
    const page = Number(req.query.page ?? 1);
    res.json(await admin.listUsers(req.query.search as string | undefined, page));
  }),
);

adminRoutes.put(
  "/users/:id/role",
  authorize("users.update_role"),
  validate(z.object({ role: z.enum(["admin", "user"]) })),
  asyncHandler(async (req, res) => {
    await admin.setUserRole(req.user!.id, req.params.id, req.body.role);
    await logAudit({
      actorId: req.user!.id,
      targetId: req.params.id,
      action: "role.assigned",
      metadata: { role: req.body.role },
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRoutes.put(
  "/users/:id/ban",
  authorize("users.ban"),
  validate(z.object({ banned: z.boolean() })),
  asyncHandler(async (req, res) => {
    await admin.setUserBan(req.user!.id, req.params.id, req.body.banned);
    await logAudit({
      actorId: req.user!.id,
      targetId: req.params.id,
      action: req.body.banned ? "user.banned" : "user.unbanned",
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRoutes.delete(
  "/users/:id",
  authorize("users.delete"),
  asyncHandler(async (req, res) => {
    await admin.deleteUser(req.user!.id, req.params.id);
    await logAudit({
      actorId: req.user!.id,
      targetId: req.params.id,
      action: "user.deleted",
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRoutes.get(
  "/boards",
  authorize("boards.list_all"),
  asyncHandler(async (req, res) => {
    const [boards, total] = await admin.listAllBoards(Number(req.query.page ?? 1));
    res.json({ boards, total });
  }),
);

adminRoutes.delete(
  "/boards/:id",
  authorize("boards.delete_any"),
  asyncHandler(async (req, res) => {
    await boardService.deleteBoard(req.params.id, req.user!.id);
    await logAudit({
      actorId: req.user!.id,
      targetId: req.params.id,
      action: "board.deleted_by_admin",
      ip: req.ip,
    });
    res.json({ ok: true });
  }),
);

adminRoutes.get(
  "/stats",
  authorize("system.view_stats"),
  asyncHandler(async (_req, res) => {
    res.json(await admin.getStats());
  }),
);

adminRoutes.get(
  "/activity",
  authorize("system.view_activity"),
  asyncHandler(async (req, res) => {
    const rows = await admin.getActivity(Number(req.query.page ?? 1));
    res.json(rows.map((r) => ({ ...r, id: String(r.id) })));
  }),
);
