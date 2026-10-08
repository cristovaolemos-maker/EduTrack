import type { RequestHandler } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

export type Role = "admin" | "teacher" | "student";

declare global {
  namespace Express {
    interface Request {
      edutrackUser?: typeof usersTable.$inferSelect;
    }
  }
}

export const requireAuth: RequestHandler = async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "É necessário iniciar sessão." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user || user.status !== "active") {
    req.session.destroy(() => undefined);
    res.status(401).json({ error: "Sessão inválida." });
    return;
  }
  req.edutrackUser = user;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.edutrackUser || !roles.includes(req.edutrackUser.role as Role)) {
      res.status(403).json({ error: "Você não tem permissão para esta operação." });
      return;
    }
    next();
  };
}
