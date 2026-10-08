import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  LoginBody,
  LoginResponse,
} from "@workspace/api-zod";
import {
  db,
  auditLogsTable,
  studentsTable,
  teachersTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/edutrack-auth";

const router: IRouter = Router();

export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Muitas tentativas. Tente novamente em alguns minutos." },
});

function safeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

async function linkedProfiles(userId: number) {
  const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.userId, userId)).limit(1);
  const [teacher] = await db.select({ id: teachersTable.id }).from(teachersTable).where(eq(teachersTable.userId, userId)).limit(1);
  return { studentId: student?.id ?? null, teacherId: teacher?.id ?? null };
}

router.post("/auth/login", loginRateLimit, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Informe um e-mail válido e uma senha com pelo menos 8 caracteres." });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email.toLowerCase())).limit(1);
  if (!user || user.status !== "active" || !(await compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "E-mail ou senha inválidos." });
    return;
  }

  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.userId = user.id;
  await db.insert(auditLogsTable).values({ actorId: user.id, action: "login", entity: "session" });
  const profiles = await linkedProfiles(user.id);
  res.json(LoginResponse.parse({ user: safeUser(user), ...profiles }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  if (req.session.userId) {
    await db.insert(auditLogsTable).values({ actorId: req.session.userId, action: "logout", entity: "session" });
  }
  req.session.destroy((error) => {
    if (error) {
      res.status(500).json({ error: "Não foi possível encerrar a sessão." });
      return;
    }
    res.clearCookie("edutrack.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.status(204).end();
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const user = req.edutrackUser!;
  const profiles = await linkedProfiles(user.id);
  res.json(LoginResponse.parse({ user: safeUser(user), ...profiles }));
});

export default router;
