import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRouter } from "../src/http/router.js";

describe("HTTP router", () => {
  it("matches method and path and extracts decoded named parameters", () => {
    const router = createRouter();
    const handler = () => {};
    router.add("get", "/api/events/:eventId/tickets/:ticketId", handler);

    const match = router.match("GET", "/api/events/event%201/tickets/ticket-2");
    assert.equal(match.handler, handler);
    assert.deepEqual(match.params, { eventId: "event 1", ticketId: "ticket-2" });
  });

  it("does not match a different method or path", () => {
    const router = createRouter();
    router.add("GET", "/api/events/:eventId", () => {});

    assert.equal(router.match("POST", "/api/events/one"), undefined);
    assert.equal(router.match("GET", "/api/bookings/one"), undefined);
  });

  it("accepts a trailing slash and rejects duplicate parameter names", () => {
    const router = createRouter();
    router.add("GET", "/api/events/:eventId", () => {});

    assert.ok(router.match("GET", "/api/events/one/"));
    assert.throws(
      () => router.add("GET", "/api/:id/tickets/:id", () => {}),
      /unique/,
    );
  });
});
