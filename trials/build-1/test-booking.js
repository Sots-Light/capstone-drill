import {
  createStore, createEvent, addTier, bookTickets, findBookingByReference,
  cancelBooking, seatsLeft, MAX_TICKETS_PER_BOOKING,
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
const tier = addTier(store, event.id, { name: "Regular", priceInKobo: 500000, capacity: 3 });
console.log(seatsLeft(tier));                  // 3

const booking = bookTickets(store, tier.id, "user-ada", ["Ada Obi", "Tunde Bello"]);
console.log(booking);                          // pending, 2 tickets, amountInKobo 1000000
console.log(seatsLeft(tier));                  // 1

expectError("2 tickets with 1 seat left", "SOLD_OUT", () => bookTickets(store, tier.id, "user-x", ["A", "B"]));
expectError("no names", "VALIDATION", () => bookTickets(store, tier.id, "user-x", []));
expectError("blank name", "VALIDATION", () => bookTickets(store, tier.id, "user-x", ["Ada", "  "]));
expectError("too many tickets", "VALIDATION", () =>
  bookTickets(store, tier.id, "user-x", Array(MAX_TICKETS_PER_BOOKING + 1).fill("A")));
expectError("unknown tier", "NOT_FOUND", () => bookTickets(store, "WRONGID", "user-x", ["A"]));
console.log(seatsLeft(tier));                  // still 1: failed bookings changed nothing

console.log(findBookingByReference(store, booking.reference) === booking);  // true
console.log(findBookingByReference(store, "NOPE-0000"));                    // undefined

cancelBooking(store, booking.reference);
console.log(booking.status);                   // cancelled
console.log(seatsLeft(tier));                  // 3
expectError("cancel twice", "INVALID_TRANSITION", () => cancelBooking(store, booking.reference));
console.log(seatsLeft(tier));                  // still 3: seats were released only once
expectError("cancel unknown", "NOT_FOUND", () => cancelBooking(store, "NOPE-0000"));