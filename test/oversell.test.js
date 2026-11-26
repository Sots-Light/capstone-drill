import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createApplication } from "../src/application.js";
import { createEventService } from "../src/services/eventService.js";
import { createSqliteRepository } from "../src/repositories/sqlite.js";

describe("SQLite last-seat booking concurrency", () => {
  let temporaryDirectory;
  let repository;
  let server;
  let baseUrl;
  let tierId;

  beforeEach(async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "capstone-oversell-test-"));
    repository = createSqliteRepository({
      filename: path.join(temporaryDirectory, "test.sqlite"),
    });
    const eventService = createEventService(repository);
    const event = await eventService.createEvent("organizer-1", {
      title: "Last Seat Test",
      city: "Lagos",
      venue: "Test Hall",
      startsAt: "2030-01-05T16:00:00.000Z",
    });
    const tier = await eventService.addTier("organizer-1", event.id, {
      name: "Last seat",
      priceInKobo: 500000,
      capacity: 1,
    });
    tierId = tier.id;
    await eventService.publishEvent("organizer-1", event.id);

    ({ server } = createApplication({ repository }));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    repository?.close();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("allows exactly one of 50 simultaneous API booking requests to reserve the last seat", async () => {
    const responses = await Promise.all(
      Array.from({ length: 50 }, (_, index) => fetch(`${baseUrl}/api/bookings`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-user-id": `attendee-${index + 1}`,
        },
        body: JSON.stringify({
          tierId,
          tickets: [{ firstName: `Guest${index + 1}`, lastName: "Example" }],
        }),
      })),
    );
    const bodies = await Promise.all(responses.map((response) => response.json()));
    const successfulBookings = responses
      .map((response, index) => ({ response, body: bodies[index] }))
      .filter(({ response }) => response.status === 201);
    const soldOutResponses = bodies.filter((body) => body.error?.code === "SOLD_OUT");

    assert.equal(successfulBookings.length, 1);
    assert.equal(soldOutResponses.length, 49);
    const tier = await repository.getTier(tierId);
    assert.equal(tier.sold, 1);
    assert.ok(tier.sold <= tier.capacity);

    const savedBooking = await repository.getBookingByReference(
      successfulBookings[0].body.reference,
    );
    assert.equal(savedBooking.tickets.length, 1);
    assert.equal(savedBooking.tickets[0].firstName, successfulBookings[0].body.tickets[0].firstName);
  });
});
