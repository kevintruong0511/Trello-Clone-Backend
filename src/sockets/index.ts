import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { verifyAccessToken } from "../utils/tokens.js";

let io: Server | null = null;

export const initSockets = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("unauthenticated"));
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("unauthenticated"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("board:join", async (boardId: string) => {
      const member = await prisma.boardMember.findUnique({
        where: { boardId_userId: { boardId, userId: socket.data.userId } },
      });
      if (member) {
        socket.join(`board:${boardId}`);
        socket.to(`board:${boardId}`).emit("presence:joined", {
          userId: socket.data.userId,
        });
      }
    });
    socket.on("board:leave", (boardId: string) => {
      socket.leave(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit("presence:left", {
        userId: socket.data.userId,
      });
    });
  });

  return io;
};

/** Emit to everyone in a board room. Call after DB commit. */
export const emitToBoard = (boardId: string, event: string, payload: unknown) => {
  io?.to(`board:${boardId}`).emit(event, payload);
};
