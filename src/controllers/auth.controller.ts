import type { Request, Response } from "express";
import * as authService from "../services/auth.service.js";
import { env } from "../config/env.js";

const REFRESH_COOKIE = "refresh_token";

const setRefreshCookie = (res: Response, token: string) =>
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: env.refreshTokenTtlSec * 1000,
  });

const clearRefreshCookie = (res: Response) =>
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });

export const register = async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  const { userId, accessToken, refreshToken } = await authService.register(
    name,
    email,
    password,
  );
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ accessToken, user: await authService.getMe(userId) });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { userId, accessToken, refreshToken } = await authService.login(
    email,
    password,
    req.ip,
  );
  setRefreshCookie(res, refreshToken);
  res.json({ accessToken, user: await authService.getMe(userId) });
};

export const renew = async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ error: "NO_REFRESH_TOKEN" });
  try {
    const { accessToken, refreshToken } = await authService.renew(token, req.ip);
    setRefreshCookie(res, refreshToken);
    res.json({ accessToken });
  } catch (e) {
    clearRefreshCookie(res);
    throw e;
  }
};

export const logout = async (req: Request, res: Response) => {
  await authService.logout(req.user?.jti, req.user?.exp, req.cookies?.[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  res.json({ ok: true });
};

export const logoutAll = async (req: Request, res: Response) => {
  await authService.logoutAll(req.user!.id);
  clearRefreshCookie(res);
  res.json({ ok: true });
};

export const me = async (req: Request, res: Response) => {
  res.json(await authService.getMe(req.user!.id));
};
