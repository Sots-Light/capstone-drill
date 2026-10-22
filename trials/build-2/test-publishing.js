import {
  addTier,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  unpublishEvent,
} from "../../src/domain/inventory.js";

const store = createStore();
const event = createEvent(store, {
  title: "Build 2 Practice Event",
  city: "Lagos",
  venue: "City Hall",
  startsAt: "2026-12-05T17:00:00+01:00",
  organizerId: "organizer-1",
});

console.log("Drafts on the public list:", listEventSummaries(store).length);

try {
  publishEvent(store, event.id);
} catch (error) {
  if (error.code !== "INVALID_STATE") throw error;
  console.log("Publishing without a tier:", error.code);
}

addTier(store, event.id, { name: "General", priceInKobo: 500000, capacity: 100 });
publishEvent(store, event.id);
console.log("After publishing:", listEventSummaries(store).map((summary) => summary.title));

unpublishEvent(store, event.id);
console.log("After unpublishing:", listEventSummaries(store).length);
