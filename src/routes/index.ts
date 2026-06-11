import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { boardRoutes } from "./board.routes.js";
import { cardRoutes, columnRoutes } from "./kanban.routes.js";
import { adminRoutes } from "./admin.routes.js";
import { authenticate } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import * as authController from "../controllers/auth.controller.js";

export const apiRoutes = Router();

apiRoutes.use("/auth", authRoutes);
apiRoutes.get("/me", authenticate, asyncHandler(authController.me));
apiRoutes.use("/boards", boardRoutes);
apiRoutes.use("/columns", columnRoutes);
apiRoutes.use("/cards", cardRoutes);
apiRoutes.use("/admin", adminRoutes);
