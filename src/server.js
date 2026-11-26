import { pathToFileURL } from "node:url";
import { createApplication } from "./application.js";
import { getConfig } from "./config.js";
import { defaultDatabasePath } from "./db/connection.js";
import { createSqliteRepository } from "./repositories/sqlite.js";

export function startServer({
  port = getConfig().port,
  publicDir,
  paymentGateway,
  repository = createSqliteRepository({ filename: defaultDatabasePath }),
} = {}) {
  const application = createApplication({ publicDir, paymentGateway, repository });
  application.server.once("close", () => repository.close?.());
  application.server.listen(port, () => {
    console.log(`Event Ticketing server listening on http://localhost:${port}`);
  });
  return application.server;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  startServer();
}
