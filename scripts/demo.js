import {
  createStore, createEvent, addTier, bookTickets, cancelBooking,
  joinWaitlist, offerNextOnWaitlist, seatsLeft, findBookingByReference,
} from "../src/domain/inventory.js";

const store = createStore();

console.log("1. An organizer creates an event with one small tier");
const event = createEvent(store, {
  title: "Halleluyah Challenge", city: "Abuja", venue: "City Hall",
  startsAt: "2026-12-05T17:00:00+01:00", organizerId: "org-1",
});
const vip = addTier(store, event.id, { name: "VIP", priceInKobo: 1000000, capacity: 3 });
console.log(`   ${event.title}: ${vip.name} has ${seatsLeft(vip)} seats`);

console.log("2. Ada books all 3 seats and the tier sells out");
const adaBooking = bookTickets(store, vip.id, "user-ada", ["Ada Obi", "Tunde Bello", "Chioma Eze"]);
console.log(`   Booking ${adaBooking.reference}, seats left: ${seatsLeft(vip)}`);

console.log("3. Emeka tries to book and is refused");
try {
  bookTickets(store, vip.id, "user-emeka", ["Emeka Obi"]);
} catch (err) {
  console.log(`   Refused: ${err.code} - ${err.message}`);
}

console.log("4. Emeka and Ngozi join the waitlist");
console.log("   Emeka is in position", joinWaitlist(store, vip.id, "user-emeka", ["Emeka Obi"]).position);
console.log("   Ngozi is in position", joinWaitlist(store, vip.id, "user-ngozi", ["Ngozi Ade"]).position);

console.log("5. Ada cancels her booking");
cancelBooking(store, adaBooking.reference);
console.log(`   Status: ${findBookingByReference(store, adaBooking.reference).status}, seats left: ${seatsLeft(vip)}`);

console.log("6. The next person in line is offered the seats");
const next = offerNextOnWaitlist(store, vip.id);
console.log(`   Next in line: ${next.holderNames.join(", ")} (booked by ${next.bookedBy})`);