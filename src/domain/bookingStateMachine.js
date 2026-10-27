import { DomainError } from "./errors.js";

export const BOOKING_STATES = Object.freeze([
  "pending",
  "paid",
  "cancelled",
  "refunded",
  "checked_in",
]);

const bookingMoves = Object.freeze({
  pending: Object.freeze(["paid", "cancelled"]),
  paid: Object.freeze(["checked_in", "refunded", "cancelled"]),
  cancelled: Object.freeze([]),
  refunded: Object.freeze([]),
  checked_in: Object.freeze([]),
});

export const TICKET_STATES = Object.freeze(["valid", "refunded", "cancelled", "checked_in"]);

const ticketMoves = Object.freeze({
  valid: Object.freeze(["refunded", "cancelled", "checked_in"]),
  refunded: Object.freeze([]),
  cancelled: Object.freeze([]),
  checked_in: Object.freeze([]),
});

function canMove(transitions, from, to) {
  return Object.hasOwn(transitions, from) && transitions[from].includes(to);
}

function assertMove(transitions, from, to, subject) {
  if (!canMove(transitions, from, to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `A ${subject} cannot move from "${from}" to "${to}"`,
    );
  }
}

export function canTransition(from, to) {
  return canMove(bookingMoves, from, to);
}

export function assertTransition(from, to) {
  assertMove(bookingMoves, from, to, "booking");
}

export function transitionBooking(booking, to) {
  assertTransition(booking.status, to);
  booking.status = to;
  return booking;
}

export function canTransitionTicket(from, to) {
  return canMove(ticketMoves, from, to);
}

export function assertTicketTransition(from, to) {
  assertMove(ticketMoves, from, to, "ticket");
}

export function transitionTicket(ticket, to) {
  assertTicketTransition(ticket.status, to);
  ticket.status = to;
  return ticket;
}
