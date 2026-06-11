import { z } from "zod";

export const createBoardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  workspaceId: z.string().uuid().optional(),
  background: z.string().max(200).optional(),
  visibility: z.enum(["private", "workspace"]).optional(),
});

export const updateBoardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  background: z.string().max(200).nullable().optional(),
  visibility: z.enum(["private", "workspace"]).optional(),
  isClosed: z.boolean().optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["member", "viewer"]).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["owner", "member", "viewer"]),
});

export const createColumnSchema = z.object({
  title: z.string().min(1).max(200),
});

export const updateColumnSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  position: z.number().optional(),
});

export const createCardSchema = z.object({
  title: z.string().min(1).max(500),
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).nullable().optional(),
  columnId: z.string().uuid().optional(),
  position: z.number().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  dueComplete: z.boolean().optional(),
  cover: z.string().max(200).nullable().optional(),
  isArchived: z.boolean().optional(),
});

export const createCommentSchema = z.object({
  text: z.string().min(1).max(5000),
});

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});
