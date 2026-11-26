import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSqliteRepository } from "../src/repositories/sqlite.js";
import { createEventService } from "../src/services/eventService.js";
import { createBookingService } from "../src/services/bookingService.js";
import { createMockPaymentGateway } from "../src/lib/mockPaymentGateway.js";

describe("SQLite repository", () => {
  let temporaryDirectory;
  let repository;

  afterEach(async () => {
    repository?.close();
    if (temporaryDirectory) {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("persists events, bookings, ticket IDs, and partial refunds after reopening the database", async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "capstone-sqlite-test-"));
    const filename = path.join(temporaryDirectory, "test.sqlite");
    repository = createSqliteRepository({ filename });
    const eventService = createEventService(repository);
    const bookingService = createBookingService(repository, createMockPaymentGateway());

    const event = await eventService.createEvent("organizer-1", {
      title: "Persistent Event",
      city: "Lagos",
      venue: "Test Hall",
      startsAt: "2030-01-05T16:00:00.000Z",
    });
    const tier = await eventService.addTier("organizer-1", event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 3,
    });
    await eventService.publishEvent("organizer-1", event.id);
    const booking = await bookingService.createBooking("attendee-1", {
      tierId: tier.id,
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
        { firstName: "Chioma", lastName: "Eze" },
      ],
    });
    await bookingService.payForBooking("attendee-1", booking.reference);
    await bookingService.refundTicket("attendee-1", booking.reference, booking.tickets[1].id);
    repository.close();
    repository = createSqliteRepository({ filename });

    const savedEvent = await repository.getEvent(event.id);
    const savedTier = await repository.getTier(tier.id);
    const savedBooking = await repository.getBookingByReference(booking.reference);
    assert.equal(savedEvent.status, "published");
    assert.deepEqual(savedEvent.tierIds, [tier.id]);
    assert.equal(savedTier.sold, 2);
    assert.equal(savedBooking.status, "paid");
    assert.equal(savedBooking.refundedAmountInKobo, 500000);
    assert.deepEqual(
      savedBooking.tickets.map(({ id, status }) => ({ id, status })),
      [
        { id: booking.tickets[0].id, status: "valid" },
        { id: booking.tickets[1].id, status: "refunded" },
        { id: booking.tickets[2].id, status: "valid" },
      ],
    );
  });

  it("uses database constraints to reject tier sales beyond capacity", async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), "capstone-sqlite-check-"));
    repository = createSqliteRepository({
      filename: path.join(temporaryDirectory, "test.sqlite"),
    });
    const eventService = createEventService(repository);
    const event = await eventService.createEvent("organizer-1", {
      title: "Constraint Test",
      city: "Lagos",
      startsAt: "2030-01-05",
    });
    const tier = await eventService.addTier("organizer-1", event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 1,
    });

    await assert.rejects(
      repository.saveTier({ ...tier, sold: 2 }),
      /CHECK constraint failed/,
    );
    assert.equal((await repository.getTier(tier.id)).sold, 0);
  });
});
