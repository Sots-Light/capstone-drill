import {
  assertTransition,
  transitionTicket,
} from "../../src/domain/bookingStateMachine.js";

const booking = { id: "booking-1", status: "paid" };
const tickets = [
  { id: "ticket-1", status: "valid" },
  { id: "ticket-2", status: "valid" },
  { id: "ticket-3", status: "valid" },
];

transitionTicket(tickets[2], "refunded");
console.log("After returning one ticket:", tickets.map(({ id, status }) => `${id}: ${status}`));
console.log("The overall booking remains:", booking.status);

try {
  assertTransition("cancelled", "paid");
} catch (error) {
  if (error.code !== "INVALID_TRANSITION") throw error;
  console.log("Trying to pay for a cancelled booking is rejected:", error.code);
}
