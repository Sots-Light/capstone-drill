import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_STATES,
  TICKET_STATES,
  assertTicketTransition,
  assertTransition,
  canTransition,
  canTransitionTicket,
  transitionTicket,
} from "../src/domain/bookingStateMachine.js";
import { DomainError } from "../src/domain/errors.js";

const allowedBookingMoves = [
  ["pending", "paid"],
  ["pending", "cancelled"],
  ["paid", "checked_in"],
  ["paid", "refunded"],
  ["paid", "cancelled"],
];

const allowedTicketMoves = [
  ["valid", "refunded"],
  ["valid", "cancelled"],
  ["valid", "checked_in"],
];

function isAllowed(moves, from, to) {
  return moves.some(([allowedFrom, allowedTo]) => allowedFrom === from && allowedTo === to);
}

describe("booking state machine", () => {
  it("accepts every allowed booking transition", () => {
    for (const [from, to] of allowedBookingMoves) {
      assert.equal(canTransition(from, to), true);
      assert.doesNotThrow(() => assertTransition(from, to));
    }
  });

  it("rejects every other transition between known booking states", () => {
    for (const from of BOOKING_STATES) {
      for (const to of BOOKING_STATES) {
        if (isAllowed(allowedBookingMoves, from, to)) continue;
        assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
        assert.throws(
          () => assertTransition(from, to),
          (error) => error instanceof DomainError && error.code === "INVALID_TRANSITION",
        );
      }
    }
  });

  it("rejects unknown booking states", () => {
    assert.equal(canTransition("unknown", "paid"), false);
    assert.throws(() => assertTransition("pending", "unknown"), { code: "INVALID_TRANSITION" });
  });

  it("allows only the listed ticket transitions", () => {
    for (const [from, to] of allowedTicketMoves) {
      assert.equal(canTransitionTicket(from, to), true);
      assert.doesNotThrow(() => assertTicketTransition(from, to));
    }

    for (const from of TICKET_STATES) {
      for (const to of TICKET_STATES) {
        if (isAllowed(allowedTicketMoves, from, to)) continue;
        assert.equal(canTransitionTicket(from, to), false, `${from} -> ${to}`);
        assert.throws(
          () => assertTicketTransition(from, to),
          (error) => error instanceof DomainError && error.code === "INVALID_TRANSITION",
        );
      }
    }
  });

  it("can refund one ticket without changing the other tickets", () => {
    const booking = {
      status: "paid",
      tickets: [
        { id: "ticket-1", status: "valid" },
        { id: "ticket-2", status: "valid" },
        { id: "ticket-3", status: "valid" },
      ],
    };

    transitionTicket(booking.tickets[2], "refunded");

    assert.equal(booking.status, "paid");
    assert.deepEqual(booking.tickets.map((ticket) => ticket.status), ["valid", "valid", "refunded"]);
  });
});
