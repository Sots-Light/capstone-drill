import {
  addTier,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
} from "../../src/domain/inventory.js";
import { filterEvents, searchEvents } from "../../src/domain/eventSearch.js";

const store = createStore();
const events = [
  {
    title: "Lagos Tech Meetup",
    city: "Lagos",
    startsAt: "2026-12-05T17:00:00Z",
    priceInKobo: 500000,
  },
  {
    title: "Abuja Jazz Night",
    city: "Abuja",
    startsAt: "2026-12-08T19:00:00Z",
    priceInKobo: 300000,
  },
];

for (const item of events) {
  const event = createEvent(store, {
    title: item.title,
    city: item.city,
    venue: `${item.city} Hall`,
    startsAt: item.startsAt,
    organizerId: "organizer-1",
  });
  addTier(store, event.id, {
    name: "General",
    priceInKobo: item.priceInKobo,
    capacity: 50,
  });
  publishEvent(store, event.id);
}

const summaries = listEventSummaries(store);
console.log("Search for JAZZ:", filterEvents(summaries, { q: "JAZZ" }).map((event) => event.title));
console.log("Lagos, cheapest first:", searchEvents(summaries, { city: "lagos" }, "price").map((event) => event.title));
console.log("Events up to Dec 5:", filterEvents(summaries, { to: "2026-12-05" }).map((event) => event.title));
