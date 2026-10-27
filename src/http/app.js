import { createServer } from "node:http";
import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DomainError } from "../domain/errors.js";
import { createRouter } from "./router.js";

const MAX_JSON_BODY_BYTES = 1024 * 1024;

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function statusForError(error) {
  if (error.statusCode) return error.statusCode;
  if (error.code === "VALIDATION" || error.code === "BAD_JSON") return 400;
  if (error.code === "BAD_REQUEST" || error instanceof URIError) return 400;
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "FORBIDDEN") return 403;
  if (error.code === "PAYLOAD_TOO_LARGE") return 413;
  if (error.code === "PAYMENT_DECLINED") return 402;
  if (error.code === "REFUND_DECLINED") return 402;
  if (error.code === "INVALID_STATE" || error.code === "INVALID_TRANSITION" || error.code === "SOLD_OUT") {
    return 409;
  }
  return 500;
}

function sendError(response, error) {
  const statusCode = statusForError(error);
  const code = statusCode === 500 ? "INTERNAL_ERROR" : error.code ?? "BAD_REQUEST";
  const message = statusCode === 500 ? "An internal server error occurred" : error.message;
  if (statusCode === 500) console.error(error);
  sendJson(response, statusCode, { error: { code, message } });
}

async function readJsonBody(request) {
  const contentType = request.headers["content-type"] ?? "";
  if (contentType.toLowerCase().split(";")[0].trim() !== "application/json") return undefined;

  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new DomainError("PAYLOAD_TOO_LARGE", "JSON request body is too large");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new DomainError("BAD_JSON", "Request body must contain valid JSON");
  }
}

function isInsideDirectory(directory, target) {
  const relative = path.relative(directory, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

async function serveStaticFile(request, response, publicDir, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") return false;

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new DomainError("VALIDATION", "URL path contains invalid encoding");
  }

  if (decodedPath.includes("\0") || decodedPath.includes("\\")) {
    throw new DomainError("NOT_FOUND", "File not found");
  }

  let publicRoot;
  try {
    publicRoot = await realpath(publicDir);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ENOTDIR") {
      throw new DomainError("NOT_FOUND", "File not found");
    }
    throw error;
  }
  let candidate = path.resolve(publicRoot, `.${decodedPath}`);
  if (!isInsideDirectory(publicRoot, candidate)) {
    throw new DomainError("NOT_FOUND", "File not found");
  }

  try {
    if ((await stat(candidate)).isDirectory()) candidate = path.join(candidate, "index.html");
    candidate = await realpath(candidate);
    if (!isInsideDirectory(publicRoot, candidate) || !(await stat(candidate)).isFile()) {
      throw new DomainError("NOT_FOUND", "File not found");
    }
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (error.code === "ENOENT" || error.code === "ENOTDIR" || error.code === "EACCES") {
      throw new DomainError("NOT_FOUND", "File not found");
    }
    throw error;
  }

  const contents = await readFile(candidate);
  response.writeHead(200, {
    "content-type": CONTENT_TYPES[path.extname(candidate).toLowerCase()] ?? "application/octet-stream",
    "content-length": contents.length,
    "x-content-type-options": "nosniff",
  });
  response.end(request.method === "HEAD" ? undefined : contents);
  return true;
}

export function createApp({ publicDir = path.resolve("public"), router = createRouter() } = {}) {
  router.add("GET", "/health", () => ({
    statusCode: 200,
    body: { status: "ok" },
  }));

  return createServer(async (request, response) => {
    try {
      let requestUrl;
      try {
        requestUrl = new URL(request.url, "http://localhost");
      } catch {
        throw new DomainError("BAD_REQUEST", "Request URL is invalid");
      }
      request.body = await readJsonBody(request);

      const matched = router.match(request.method, requestUrl.pathname);
      if (matched) {
        const result = await matched.handler({
          request,
          params: matched.params,
          pathname: requestUrl.pathname,
          searchParams: requestUrl.searchParams,
        });
        if (response.writableEnded) return;
        const statusCode = result?.statusCode ?? 200;
        if (result?.body === undefined) {
          response.writeHead(statusCode);
          response.end();
        } else {
          sendJson(response, statusCode, result.body);
        }
        return;
      }

      if (requestUrl.pathname.startsWith("/api/") || requestUrl.pathname === "/api") {
        sendError(response, new DomainError("NOT_FOUND", "API route not found"));
        return;
      }

      if (await serveStaticFile(request, response, publicDir, requestUrl.pathname)) return;
      sendError(response, new DomainError("NOT_FOUND", "File not found"));
    } catch (error) {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      sendError(response, error);
    }
  });
}
