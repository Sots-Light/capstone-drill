import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  seatsLeft,
  unpublishEvent,
} from "../src/domain/inventory.js";
import { DomainError } from "../src/domain/errors.js";

function assertDomainError(action, code) {
  assert.throws(action, (error) => error instanceof DomainError && error.code === code);
}

function makeDraft(store, title = "Lagos Tech Meetup") {
  return createEvent(store, {
    title,
    city: "Lagos",
    venue: "City Hall",
    startsAt: "2026-12-05T17:00:00+01:00",
    organizerId: "organizer-1",
  });
}

describe("Build 2 inventory stories", () => {
  it("S02: creates a draft with an ID, hidden from the public list", () => {
    const store = createStore();
    const event = makeDraft(store);

    assert.ok(event.id);
    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
    assert.equal(listEventSummaries(store, { publishedOnly: false }).length, 1);
  });

  it("S02: rejects missing required fields and impossible dates without saving", () => {
    const store = createStore();
    const valid = {
      title: "Valid event",
      city: "Lagos",
      startsAt: "2026-12-05T17:00:00Z",
    };

    for (const input of [
      { ...valid, title: " " },
      { ...valid, city: "" },
      { ...valid, startsAt: "2026-02-30T17:00:00Z" },
      { ...valid, startsAt: "not a date" },
    ]) {
      assertDomainError(() => createEvent(store, input), "VALIDATION");
    }
    assert.equal(store.events.size, 0);
  });

  it("S03: saves a tier with zero sold and the full capacity available", () => {
    const store = createStore();
    const event = makeDraft(store);
    const tier = addTier(store, event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 100,
    });

    assert.equal(tier.sold, 0);
    assert.equal(seatsLeft(tier), 100);
  });

  it("S03: rejects invalid prices and capacities without saving a tier", () => {
    const store = createStore();
    const event = makeDraft(store);
    const valid = { name: "General", priceInKobo: 500000, capacity: 100 };

    for (const input of [
      { ...valid, priceInKobo: 12.5 },
      { ...valid, priceInKobo: 0 },
      { ...valid, capacity: 0 },
      { ...valid, capacity: 1.5 },
    ]) {
      assertDomainError(() => addTier(store, event.id, input), "VALIDATION");
    }
    assert.equal(store.tiers.size, 0);
    assert.deepEqual(event.tierIds, []);
  });

  it("S03: returns NOT_FOUND when adding a tier to a missing event", () => {
    const store = createStore();
    assertDomainError(
      () => addTier(store, "missing-event", { name: "General", priceInKobo: 500000, capacity: 10 }),
      "NOT_FOUND",
    );
    assert.equal(store.tiers.size, 0);
  });

  it("S04: publishes a tiered event and shows it publicly", () => {
    const store = createStore();
    const event = makeDraft(store);
    addTier(store, event.id, { name: "General", priceInKobo: 500000, capacity: 100 });

    assert.equal(publishEvent(store, event.id).status, "published");
    assert.equal(listEventSummaries(store).length, 1);
  });

  it("S04: rejects publishing without tiers and leaves the event hidden as a draft", () => {
    const store = createStore();
    const event = makeDraft(store);

    assertDomainError(() => publishEvent(store, event.id), "INVALID_STATE");
    assert.equal(event.status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
  });

  it("S04: unpublishes an event and removes it from the public list", () => {
    const store = createStore();
    const event = makeDraft(store);
    addTier(store, event.id, { name: "General", priceInKobo: 500000, capacity: 100 });
    publishEvent(store, event.id);

    assert.equal(unpublishEvent(store, event.id).status, "draft");
    assert.deepEqual(listEventSummaries(store), []);
  });

  it("S06: creates a pending booking with kobo totals and a unique ID per ticket", () => {
    const store = createStore();
    const event = makeDraft(store);
    const tier = addTier(store, event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 3,
    });
    const booking = bookTickets(store, tier.id, "attendee-1", ["Ada Obi", "Tunde Bello"]);

    assert.equal(booking.status, "pending");
    assert.equal(booking.tickets.length, 2);
    assert.equal(booking.amountInKobo, 1000000);
    assert.equal(seatsLeft(tier), 1);
    assert.ok(booking.id);
    assert.ok(booking.tickets.every((ticket) => ticket.id));
    assert.notEqual(booking.tickets[0].id, booking.tickets[1].id);
  });

  it("S06: rejects an oversold booking without changing seats or saved bookings", () => {
    const store = createStore();
    const event = makeDraft(store);
    const tier = addTier(store, event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 3,
    });
    bookTickets(store, tier.id, "attendee-1", ["Ada Obi", "Tunde Bello"]);

    assertDomainError(
      () => bookTickets(store, tier.id, "attendee-2", ["Chioma Eze", "Emeka Obi"]),
      "SOLD_OUT",
    );
    assert.equal(seatsLeft(tier), 1);
    assert.equal(store.bookings.size, 1);
    assert.equal(store.bookingsByReference.size, 1);
  });

  it("S06: rejects invalid ticket quantities with VALIDATION", () => {
    const store = createStore();
    const event = makeDraft(store);
    const tier = addTier(store, event.id, {
      name: "General",
      priceInKobo: 500000,
      capacity: 20,
    });

    for (const invalidNames of [[], -1, 1.5, Array(11).fill("Guest")]) {
      assertDomainError(
        () => bookTickets(store, tier.id, "attendee-1", invalidNames),
        "VALIDATION",
      );
    }
    assert.equal(seatsLeft(tier), 20);
    assert.equal(store.bookings.size, 0);
  });
});
