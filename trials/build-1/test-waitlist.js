import {
  createStore, createEvent, addTier, bookTickets, cancelBooking,
  joinWaitlist, offerNextOnWaitlist, seatsLeft,
} from "../../src/domain/inventory.js";

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
  title: "Halleluyah Challenge", city: "Abuja",
  startsAt: "2026-12-05T17:00:00+01:00", organizerId: "org-1",
});
const small = addTier(store, event.id, { name: "VIP", priceInKobo: 1000000, capacity: 2 });
const big = addTier(store, event.id, { name: "Regular", priceInKobo: 500000, capacity: 50 });

expectError("waitlist while seats exist", "NOT_SOLD_OUT", () =>
  joinWaitlist(store, big.id, "user-zed", ["Zed"]));

const first = bookTickets(store, small.id, "user-ada", ["Ada Obi", "Tunde Bello"]);
console.log(seatsLeft(small));   // 0

console.log(joinWaitlist(store, small.id, "user-chi", ["Chioma Eze"]));    // { position: 1 }
console.log(joinWaitlist(store, small.id, "user-emeka", ["Emeka Obi"]));   // { position: 2 }
expectError("blank name on waitlist", "VALIDATION", () =>
  joinWaitlist(store, small.id, "user-q", [" "]));
expectError("waitlist for unknown tier", "NOT_FOUND", () =>
  joinWaitlist(store, "WRONGID", "user-q", ["Q"]));

console.log(offerNextOnWaitlist(store, small.id));   // undefined: no seat is free yet

cancelBooking(store, first.reference);
console.log(seatsLeft(small));   // 2

const offer1 = offerNextOnWaitlist(store, small.id);
console.log(offer1);             // Chioma's entry (she was first)
bookTickets(store, small.id, offer1.bookedBy, offer1.holderNames);

const offer2 = offerNextOnWaitlist(store, small.id);
console.log(offer2);             // Emeka's entry (second in line)
console.log(offerNextOnWaitlist(store, small.id));   // undefined: the line is empty