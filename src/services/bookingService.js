import { DomainError } from "../domain/errors.js";
import { newId, newReference } from "../domain/ids.js";
import { assertTicketTransition, assertTransition, transitionBooking, transitionTicket } from "../domain/bookingStateMachine.js";

const MAX_TICKETS_PER_BOOKING = 10;

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("VALIDATION", `${field} is required`);
  }
  return value.trim();
}

function requireObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new DomainError("VALIDATION", `${field} must be an object`);
  }
  return value;
}

function requireAttendees(value) {
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > MAX_TICKETS_PER_BOOKING
  ) {
    throw new DomainError(
      "VALIDATION",
      `tickets must contain 1 to ${MAX_TICKETS_PER_BOOKING} attendees`,
    );
  }

  return value.map((attendee, index) => {
    const body = requireObject(attendee, `Ticket ${index + 1}`);
    const firstName = requireText(body.firstName, `Ticket ${index + 1} firstName`);
    const lastName = requireText(body.lastName, `Ticket ${index + 1} lastName`);
    return { firstName, lastName, holderName: `${firstName} ${lastName}` };
  });
}

export function createBookingService(repository, paymentGateway) {
  return {
    async createBooking(attendeeId, input) {
      const userId = requireText(attendeeId, "x-user-id");
      const body = requireObject(input, "Booking");
      const tierId = requireText(body.tierId, "tierId");
      const attendees = requireAttendees(body.tickets);
      const tier = await repository.getTier(tierId);
      if (!tier) throw new DomainError("NOT_FOUND", "Ticket tier not found");

      const event = await repository.getEvent(tier.eventId);
      if (!event) throw new DomainError("NOT_FOUND", "Event not found");
      if (event.status !== "published") {
        throw new DomainError("INVALID_STATE", "Tickets can only be booked for published events");
      }

      const seatsLeft = tier.capacity - tier.sold;
      if (seatsLeft < attendees.length) {
        throw new DomainError(
          "SOLD_OUT",
          seatsLeft === 0 ? `${tier.name} is sold out` : `Only ${seatsLeft} ticket(s) left in ${tier.name}`,
          { seatsLeft },
        );
      }

      const amountInKobo = tier.priceInKobo * attendees.length;
      if (!Number.isSafeInteger(amountInKobo)) {
        throw new DomainError("VALIDATION", "Booking total must be a whole number of kobo");
      }

      let reference;
      do {
        reference = newReference();
      } while (await repository.getBookingByReference(reference));

      const createdAt = new Date().toISOString();
      const booking = {
        id: newId(),
        reference,
        bookedBy: userId,
        tierId: tier.id,
        status: "pending",
        createdAt,
        amountInKobo,
        refundedAmountInKobo: 0,
        tickets: attendees.map(({ firstName, lastName, holderName }) => ({
          id: newId(),
          firstName,
          lastName,
          holderName,
          priceInKobo: tier.priceInKobo,
          status: "valid",
          issuedAt: createdAt,
          usedAt: null,
        })),
      };

      tier.sold += attendees.length;
      await repository.saveTier(tier);
      return repository.saveBooking(booking);
    },

    async payForBooking(attendeeId, reference) {
      const userId = requireText(attendeeId, "x-user-id");
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError("NOT_FOUND", "Booking not found");
      if (booking.bookedBy !== userId) {
        throw new DomainError("FORBIDDEN", "Only the attendee who made this booking can pay for it");
      }
      assertTransition(booking.status, "paid");

      const result = await paymentGateway.charge({ amountInKobo: booking.amountInKobo });
      if (!result.approved) {
        throw new DomainError("PAYMENT_DECLINED", "Mock payment was declined");
      }

      transitionBooking(booking, "paid");
      booking.paidAt = new Date().toISOString();
      return repository.saveBooking(booking);
    },

    async refundTicket(attendeeId, reference, ticketId) {
      const userId = requireText(attendeeId, "x-user-id");
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError("NOT_FOUND", "Booking not found");
      if (booking.bookedBy !== userId) {
        throw new DomainError("FORBIDDEN", "Only the attendee who made this booking can request a refund");
      }
      if (booking.status !== "paid") {
        throw new DomainError("INVALID_TRANSITION", "Only a paid booking can be refunded");
      }

      const ticket = booking.tickets.find((item) => item.id === ticketId);
      if (!ticket) throw new DomainError("NOT_FOUND", "Ticket not found in this booking");
      assertTicketTransition(ticket.status, "refunded");

      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError("NOT_FOUND", "Ticket tier not found");
      if (tier.sold < 1) {
        throw new DomainError("INVALID_STATE", "No sold seat is available to release for this ticket");
      }
      if (!Number.isSafeInteger(ticket.priceInKobo) || ticket.priceInKobo < 1) {
        throw new DomainError("INVALID_STATE", "Ticket has an invalid refund amount");
      }

      const result = await paymentGateway.refund({
        amountInKobo: ticket.priceInKobo,
        bookingReference: booking.reference,
        ticketId: ticket.id,
      });
      if (!result.approved) {
        throw new DomainError("REFUND_DECLINED", "Mock refund was declined");
      }

      transitionTicket(ticket, "refunded");
      ticket.refundedAt = new Date().toISOString();
      booking.refundedAmountInKobo = (booking.refundedAmountInKobo ?? 0) + ticket.priceInKobo;
      tier.sold -= 1;
      if (booking.tickets.every((item) => item.status === "refunded")) {
        transitionBooking(booking, "refunded");
      }

      await repository.saveTier(tier);
      return repository.saveBooking(booking);
    },

    async cancelBooking(attendeeId, reference) {
      const userId = requireText(attendeeId, "x-user-id");
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError("NOT_FOUND", "Booking not found");
      if (booking.bookedBy !== userId) {
        throw new DomainError("FORBIDDEN", "Only the attendee who made this booking can cancel it");
      }
      if (booking.status !== "pending") {
        throw new DomainError("INVALID_TRANSITION", "Only an unpaid booking can be cancelled in Build 4");
      }
      assertTransition(booking.status, "cancelled");
      for (const ticket of booking.tickets) assertTicketTransition(ticket.status, "cancelled");

      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError("NOT_FOUND", "Ticket tier not found");
      transitionBooking(booking, "cancelled");
      for (const ticket of booking.tickets) transitionTicket(ticket, "cancelled");
      tier.sold -= booking.tickets.length;
      await repository.saveTier(tier);
      return repository.saveBooking(booking);
    },
  };
}
