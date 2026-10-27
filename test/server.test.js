import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApp } from "../src/http/app.js";
import { createRouter } from "../src/http/router.js";
import { getConfig } from "../src/config.js";

describe("HTTP server skeleton", () => {
  let server;
  let baseUrl;
  let tempRoot;

  before(async () => {
    tempRoot = await mkdtemp(path.join(tmpdir(), "capstone-build3-"));
    const publicDir = path.join(tempRoot, "public");
    await mkdir(publicDir);
    await writeFile(path.join(publicDir, "sample.txt"), "static content");
    await writeFile(path.join(tempRoot, "secret.txt"), "outside public");

    const router = createRouter();
    router.add("GET", "/api/events/:eventId", ({ params }) => ({
      body: { eventId: params.eventId },
    }));
    server = createApp({ publicDir, router });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (tempRoot) await rm(tempRoot, { recursive: true, force: true });
  });

  it("answers a real HTTP request to /health with JSON status ok", async () => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  });

  it("uses the router and returns route parameters as JSON", async () => {
    const response = await fetch(`${baseUrl}/api/events/event-123`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { eventId: "event-123" });
  });

  it("returns a JSON 404 for an unknown API route", async () => {
    const response = await fetch(`${baseUrl}/api/missing`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: "NOT_FOUND", message: "API route not found" },
    });
  });

  it("returns a JSON 400 for malformed JSON", async () => {
    const response = await fetch(`${baseUrl}/api/missing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: "BAD_JSON", message: "Request body must contain valid JSON" },
    });
  });

  it("serves files from public/", async () => {
    const response = await fetch(`${baseUrl}/sample.txt`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.equal(await response.text(), "static content");
  });

  it("does not serve a path that escapes the public folder", async () => {
    const response = await fetch(`${baseUrl}/%2e%2e%2fsecret.txt`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), {
      error: { code: "NOT_FOUND", message: "File not found" },
    });
  });

  it("uses PORT or defaults to 3000, rejecting invalid port values", () => {
    assert.deepEqual(getConfig({}), { port: 3000 });
    assert.deepEqual(getConfig({ PORT: "4321" }), { port: 4321 });
    assert.throws(() => getConfig({ PORT: "70000" }), /PORT/);
    assert.throws(() => getConfig({ PORT: "not-a-port" }), /PORT/);
  });
});
