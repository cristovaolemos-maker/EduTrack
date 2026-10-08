import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoData } from "./lib/seed-demo";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await seedDemoData();
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start().catch((error: unknown) => {
  logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "API startup failed");
  process.exit(1);
});
