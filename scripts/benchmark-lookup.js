import { createStore, createEvent, addTier, bookTickets } from "../src/domain/inventory.js";

const BOOKINGS = 100000;
const LOOKUPS = 1000;

const store = createStore();
const event = createEvent(store, {
  title: "Benchmark", city: "Abuja",
  startsAt: "2026-12-05T17:00:00+01:00", organizerId: "org-1",
});
const tier = addTier(store, event.id, { name: "Regular", priceInKobo: 500000, capacity: BOOKINGS });

const bookings = [];
for (let i = 0; i < BOOKINGS; i++) {
  bookings.push(bookTickets(store, tier.id, `user-${i}`, [`Person ${i}`]));
}

const target = bookings[BOOKINGS - 1].reference; // the last one is the slowest case for a list

let start = performance.now();
for (let i = 0; i < LOOKUPS; i++) store.bookingsByReference.get(target);
const mapMs = performance.now() - start;

start = performance.now();
for (let i = 0; i < LOOKUPS; i++) bookings.find((b) => b.reference === target);
const arrayMs = performance.now() - start;

console.log(`${BOOKINGS} bookings, ${LOOKUPS} lookups of the last one`);
console.log(`Map.get:    ${mapMs.toFixed(2)} ms`);
console.log(`Array.find: ${arrayMs.toFixed(2)} ms`);
console.log(`Array.find was about ${(arrayMs / Math.max(mapMs, 0.001)).toFixed(0)}x slower`);