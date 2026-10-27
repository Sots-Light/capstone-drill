import { pathToFileURL } from "node:url";
import { createApplication } from "./application.js";
import { getConfig } from "./config.js";

export function startServer({ port = getConfig().port, publicDir, paymentGateway } = {}) {
  const application = createApplication({ publicDir, paymentGateway });
  application.server.listen(port, () => {
    console.log(`Event Ticketing server listening on http://localhost:${port}`);
  });
  return application.server;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  startServer();
}
