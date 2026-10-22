import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
} from "../src/domain/inventory.js";
import { filterEvents, searchEvents, sortEvents } from "../src/domain/eventSearch.js";
import { DomainError } from "../src/domain/errors.js";

function makePublishedEvent(store, { title, city, startsAt, tiers, venue = `${city} Hall` }) {
  const event = createEvent(store, {
    title,
    city,
    venue,
    startsAt,
    organizerId: "organizer-1",
  });
  const createdTiers = tiers.map((tier) => addTier(store, event.id, tier));
  publishEvent(store, event.id);
  return { event, tiers: createdTiers };
}

function createSummaries() {
  const store = createStore();
  makePublishedEvent(store, {
    title: "Lagos Tech Meetup",
    city: "Lagos",
    startsAt: "2026-12-05T17:00:00Z",
    tiers: [
      { name: "VIP", priceInKobo: 900000, capacity: 10 },
      { name: "General", priceInKobo: 500000, capacity: 20 },
    ],
  });
  makePublishedEvent(store, {
    title: "Abuja Jazz Night",
    city: "Abuja",
    startsAt: "2026-12-08T19:00:00Z",
    tiers: [{ name: "General", priceInKobo: 300000, capacity: 10 }],
    venue: "Arts Centre",
  });
  makePublishedEvent(store, {
    title: "Zulu Show",
    city: "Lagos",
    startsAt: "2026-12-05T09:00:00Z",
    tiers: [{ name: "General", priceInKobo: 500000, capacity: 5 }],
  });
  makePublishedEvent(store, {
    title: "Alpha Show",
    city: "Lagos",
    startsAt: "2026-12-05T21:00:00Z",
    tiers: [{ name: "General", priceInKobo: 500000, capacity: 5 }],
  });
  const soldOut = makePublishedEvent(store, {
    title: "Sold Out Gig",
    city: "Ibadan",
    startsAt: "2026-12-20T20:00:00Z",
    tiers: [{ name: "General", priceInKobo: 200000, capacity: 1 }],
  });
  bookTickets(store, soldOut.tiers[0].id, "attendee-1", ["Ada Obi"]);

  const noTierDraft = createEvent(store, {
    title: "No Tier Draft",
    city: "Lagos",
    venue: "Draft Hall",
    startsAt: "2026-12-01T10:00:00Z",
    organizerId: "organizer-1",
  });
  return {
    summaries: listEventSummaries(store),
    allSummaries: listEventSummaries(store, { publishedOnly: false }),
  };
}

const titles = (events) => events.map((event) => event.title);
const assertValidationError = (action) =>
  assert.throws(action, (error) => error instanceof DomainError && error.code === "VALIDATION");

describe("Build 2 event search story", () => {
  it("searches titles without case sensitivity", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(titles(filterEvents(summaries, { q: "JAZZ" })), ["Abuja Jazz Night"]);
  });

  it("matches search text against venue names", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(titles(filterEvents(summaries, { q: "arts centre" })), ["Abuja Jazz Night"]);
  });

  it("filters for an exact city regardless of capitalization", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(
      titles(filterEvents(summaries, { city: "lagos" })),
      ["Lagos Tech Meetup", "Zulu Show", "Alpha Show"],
    );
  });

  it("filters by the cheapest tier price in kobo and leaves events without tiers out", () => {
    const { allSummaries } = createSummaries();
    assert.deepEqual(
      titles(searchEvents(allSummaries, { maxPriceInKobo: 300000 }, "price")),
      ["Sold Out Gig", "Abuja Jazz Night"],
    );
  });

  it("sorts by date, then title for events on the same day", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(
      titles(sortEvents(summaries, "date")),
      ["Alpha Show", "Lagos Tech Meetup", "Zulu Show", "Abuja Jazz Night", "Sold Out Gig"],
    );
  });

  it("includes the whole date when the upper bound is date-only", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(
      titles(filterEvents(summaries, { to: "2026-12-05" })),
      ["Lagos Tech Meetup", "Zulu Show", "Alpha Show"],
    );
    assert.deepEqual(
      titles(filterEvents(summaries, { from: "2026-12-05", to: "2026-12-05" })),
      ["Lagos Tech Meetup", "Zulu Show", "Alpha Show"],
    );
  });

  it("sorts prices from cheapest to most expensive and puts missing prices last", () => {
    const { allSummaries } = createSummaries();
    assert.deepEqual(
      titles(sortEvents(allSummaries, "price")),
      ["Sold Out Gig", "Abuja Jazz Night", "Alpha Show", "Lagos Tech Meetup", "Zulu Show", "No Tier Draft"],
    );
  });

  it("sorts by available seats and uses title as the tie-breaker", () => {
    const { summaries } = createSummaries();
    assert.deepEqual(
      titles(sortEvents(summaries, "availability")),
      ["Lagos Tech Meetup", "Abuja Jazz Night", "Alpha Show", "Zulu Show", "Sold Out Gig"],
    );
  });

  it("filters out sold-out events when onlyAvailable is true", () => {
    const { summaries } = createSummaries();
    assert.ok(!titles(filterEvents(summaries, { onlyAvailable: true })).includes("Sold Out Gig"));
  });

  it("rejects impossible dates, fractional prices, and unknown sort options", () => {
    const { summaries } = createSummaries();
    assertValidationError(() => filterEvents(summaries, { from: "2026-02-30" }));
    assertValidationError(() => filterEvents(summaries, { to: "" }));
    assertValidationError(() => filterEvents(summaries, { maxPriceInKobo: 12.5 }));
    assertValidationError(() => sortEvents(summaries, "popularity"));
  });

  it("returns new lists without changing the source summaries", () => {
    const { summaries } = createSummaries();
    const original = structuredClone(summaries);
    const filtered = filterEvents(summaries, { city: "lagos" });
    const sorted = sortEvents(summaries, "price");

    assert.notEqual(filtered, summaries);
    assert.notEqual(sorted, summaries);
    assert.deepEqual(summaries, original);
  });

  it("handles an empty list", () => {
    assert.deepEqual(filterEvents([], { q: "anything" }), []);
    assert.deepEqual(sortEvents([], "availability"), []);
    assert.deepEqual(searchEvents([], {}, "date"), []);
  });
});
