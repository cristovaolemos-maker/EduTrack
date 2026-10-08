import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import helmet from "helmet";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import swaggerUi from "swagger-ui-express";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const app: Express = express();
const PgSession = connectPgSimple(session);

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must contain at least 32 characters.");
}
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin) { callback(null, false); return; }
    try {
      const originHost = new URL(origin).host;
      const host = process.env.REPLIT_DOMAINS?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
      if (originHost === host[0] || originHost === process.env.REPLIT_DEV_DOMAIN) {
        callback(null, true);
        return;
      }
    } catch {
      callback(null, false);
      return;
    }
    callback(null, false);
  },
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", (req, res, next) => {
  const isSafeMethod = ["GET", "HEAD", "OPTIONS"].includes(req.method);
  const origin = req.get("origin");
  if (!isSafeMethod && origin) {
    try {
      if (new URL(origin).host !== req.get("host")) {
        res.status(403).json({ error: "Origem não permitida." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Origem não permitida." });
      return;
    }
  }
  next();
});
app.use("/api", session({
  name: "edutrack.sid",
  store: new PgSession({
    pool,
    tableName: "edutrack_sessions",
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: 8 * 60 * 60 * 1000,
  },
}));

const openApiPath = path.resolve(import.meta.dirname, "../../../lib/api-spec/openapi.yaml");
const openApiYaml = readFileSync(openApiPath, "utf8");
const openApiDocument = parseYaml(openApiYaml);
app.get("/api/openapi.yaml", (_req, res) => res.type("text/yaml").send(openApiYaml));
app.get("/api/openapi.json", (_req, res) => res.json(openApiDocument));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
  customSiteTitle: "EduTrack API — Swagger",
  swaggerOptions: { persistAuthorization: false, displayRequestDuration: true },
}));
app.use("/api", router);

app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const record = error && typeof error === "object" ? error as { name?: unknown; code?: unknown; cause?: { code?: unknown } } : {};
  const rawCode = record.code ?? record.cause?.code;
  req.log.error({
    errorType: typeof record.name === "string" ? record.name : "UnknownError",
    databaseCode: typeof rawCode === "string" && /^[A-Z0-9]+$/.test(rawCode) ? rawCode : undefined,
  }, "Request failed");
  if (res.headersSent) return;
  res.status(500).json({ error: "Ocorreu um erro interno. Tente novamente." });
});

export default app;
