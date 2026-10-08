# EduTrack

EduTrack é um sistema de gestão acadêmica para administradores, professores e alunos, com autorização aplicada no servidor.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/edutrack run dev` — run the web application
- `pnpm --filter @workspace/api-server run test` — run unit and HTTP integration tests against PostgreSQL
- `pnpm --filter @workspace/db run generate` — generate a versioned SQL migration from the Drizzle schema
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` and `SESSION_SECRET` (at least 32 characters)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/edutrack` — React interface
- `artifacts/api-server` — shared Express API, EduTrack routes and session middleware
- `lib/api-spec/openapi.yaml` — REST contract source of truth
- `lib/db/src/schema/edutrack.ts` — relational schema source of truth
- `lib/db/drizzle/` — versioned SQL migrations
- `README.md` — product, local setup, test accounts, data model, API and security notes

## Architecture decisions

- Preserve the workspace's Drizzle/PostgreSQL package and shared Express API instead of introducing Prisma or a second server.
- Keep user/session information in PostgreSQL and send only an opaque `HttpOnly` session cookie to the browser.
- Run demo seed data only outside production.
- Enforce teacher/student data access on the server; frontend navigation is not authorization.

## Product

Role-aware dashboards, academic catalogs, classes, enrollments, assessments, grades, attendance, announcements, reports and administrative audit views. API documentation is served at `/api/docs`.

## User preferences

The user requests a Portuguese full-stack academic system and asks that incomplete capabilities be reported plainly rather than simulated.

## Gotchas

- Run `pnpm run typecheck:libs` after changes to shared libraries before checking leaf packages.
- The API requires `SESSION_SECRET` with at least 32 characters.
- The demo seed is idempotent and exits in production.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
