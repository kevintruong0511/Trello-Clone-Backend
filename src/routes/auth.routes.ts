import { Router } from "express";
import * as auth from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { loginSchema, registerSchema } from "../validations/auth.validation.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authRoutes = Router();

authRoutes.post("/register", validate(registerSchema), asyncHandler(auth.register));
authRoutes.post("/login", validate(loginSchema), asyncHandler(auth.login));
authRoutes.post("/renew", asyncHandler(auth.renew));
authRoutes.post("/logout", authenticate, asyncHandler(auth.logout));
authRoutes.post("/logout-all", authenticate, asyncHandler(auth.logoutAll));
