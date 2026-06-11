import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { apiRoutes } from "./routes/index.js";
import { errorHandler } from "./middlewares/error.js";

export const app = express();

app.set("trust proxy", 1);
app.use(cors({ origin: env.corsOrigin, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", apiRoutes);
app.use(errorHandler);
