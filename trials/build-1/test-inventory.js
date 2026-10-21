import { createStore, createEvent, addTier } from "../../src/domain/inventory.js";

function expectError(label, expectedCode, action) {
  try {
    action();
    console.log(`PROBLEM: ${label} was accepted`);
  } catch (err) {
    console.log(err.code === expectedCode ? `ok: ${label}` : `PROBLEM: ${label} gave ${err.code}`);
  }
}

const store = createStore();

const event = createEvent(store, {
  title: "Halleluyah Challenge",
  city: "Abuja",
  venue: "City Hall",
  startsAt: "2026-12-05T17:00:00+01:00",
  organizerId: "org-1",
});
console.log(event);              // status: 'draft', tierIds: []
console.log(store.events.size);  // 1

const regular = addTier(store, event.id, { name: "Regular", priceInKobo: 500000, capacity: 100 });
console.log(regular);            // sold: 0
console.log(event.tierIds);      // [ the tier's id ]
console.log(store.tiers.size);   // 1

expectError("missing title", "VALIDATION", () =>
  createEvent(store, { city: "Abuja", startsAt: "2026-12-05T17:00:00+01:00" }));
expectError("bad date", "VALIDATION", () =>
  createEvent(store, { title: "X", city: "Abuja", startsAt: "not a date" }));
expectError("capacity 0", "VALIDATION", () =>
  addTier(store, event.id, { name: "VIP", priceInKobo: 500000, capacity: 0 }));
expectError("price 0", "VALIDATION", () =>
  addTier(store, event.id, { name: "VIP", priceInKobo: 0, capacity: 10 }));
expectError("price 12.5", "VALIDATION", () =>
  addTier(store, event.id, { name: "VIP", priceInKobo: 12.5, capacity: 10 }));
expectError("unknown event", "NOT_FOUND", () =>
  addTier(store, "WRONGID", { name: "VIP", priceInKobo: 500000, capacity: 10 }));

console.log(store.events.size);  // still 1: failed attempts saved nothing
console.log(store.tiers.size);   // still 1