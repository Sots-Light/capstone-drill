import { createApp } from "../../src/http/app.js";

const server = createApp();

server.listen(0, "127.0.0.1", async () => {
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const health = await fetch(`${baseUrl}/health`);
    console.log("GET /health:", health.status, await health.json());

    const page = await fetch(baseUrl);
    console.log("GET /:", page.status, (await page.text()).includes("Build 3 server"));
  } finally {
    server.close();
  }
});
