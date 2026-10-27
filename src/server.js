import { pathToFileURL } from "node:url";
import { createApp } from "./http/app.js";
import { getConfig } from "./config.js";

export function startServer({ port = getConfig().port, publicDir } = {}) {
  const app = createApp(publicDir === undefined ? {} : { publicDir });
  app.listen(port, () => {
    console.log(`Event Ticketing server listening on http://localhost:${port}`);
  });
  return app;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : "";
if (import.meta.url === invokedPath) {
  startServer();
}
