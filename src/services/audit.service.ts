import { prisma } from "../config/prisma.js";

export const logAudit = (data: {
  actorId?: string | null;
  targetId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) =>
  prisma.accessAudit
    .create({
      data: {
        actorId: data.actorId ?? null,
        targetId: data.targetId ?? null,
        action: data.action,
        metadata: data.metadata as object | undefined,
        ipAddress: data.ip,
      },
    })
    .catch((e) => console.error("audit log failed", e));
