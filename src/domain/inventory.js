import { DomainError } from "./errors.js";
import { newId, newReference } from "./ids.js";
import { Queue } from "./waitlistQueue.js";

export const MAX_TICKETS_PER_BOOKING = 10;
const HOLDS_SEATS = new Set(["pending", "paid"]);

export function createStore() {
  return {
    events: new Map(),
    tiers: new Map(),
    bookings: new Map(),
    bookingsByReference: new Map(),
    waitlists: new Map(), // tier id -> Queue
  };
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DomainError("VALIDATION", `${field} is required`);
  }
  return value.trim();
}

function requireWholeNumber(value, field, min) {
  if (!Number.isInteger(value) || value < min) {
    throw new DomainError("VALIDATION", `${field} must be a whole number of at least ${min}`);
  }
  return value;
}

function requireHolderNames(holderNames) {
  if (!Array.isArray(holderNames) || holderNames.length < 1 || holderNames.length > MAX_TICKETS_PER_BOOKING) {
    throw new DomainError("VALIDATION", `Book 1 to ${MAX_TICKETS_PER_BOOKING} tickets, with a name for each`);
  }
  return holderNames.map((name) => requireText(name, "Ticket holder name"));
}

export function createEvent(store, { title, city, venue = "", startsAt, organizerId }) {
  const start = new Date(startsAt);
  if (typeof startsAt !== "string" || Number.isNaN(start.getTime())) {
    throw new DomainError("VALIDATION", "startsAt must be a valid date and time");
  }
  const event = {
    id: newId(),
    organizerId,
    title: requireText(title, "Title"),
    city: requireText(city, "City"),
    venue: String(venue).trim(),
    startsAt: start.toISOString(),
    status: "draft",
    tierIds: [],
  };
  store.events.set(event.id, event);
  return event;
}

export function addTier(store, eventId, { name, priceInKobo, capacity }) {
  const event = store.events.get(eventId);
  if (!event) throw new DomainError("NOT_FOUND", "Event not found");

  const tier = {
    id: newId(),
    eventId,
    name: requireText(name, "Tier name"),
    priceInKobo: requireWholeNumber(priceInKobo, "Price", 1),
    capacity: requireWholeNumber(capacity, "Capacity", 1),
    sold: 0,
  };
  store.tiers.set(tier.id, tier);
  store.waitlists.set(tier.id, new Queue());
  event.tierIds.push(tier.id);
  return tier;
}

export function seatsLeft(tier) {
  return tier.capacity - tier.sold;
}

function getTier(store, tierId) {
  const tier = store.tiers.get(tierId);
  if (!tier) throw new DomainError("NOT_FOUND", "Ticket tier not found");
  return tier;
}

export function bookTickets(store, tierId, bookedBy, holderNames) {
  const tier = getTier(store, tierId);
  const booker = requireText(bookedBy, "Booker");
  const names = requireHolderNames(holderNames);

  const left = seatsLeft(tier);
  if (left < names.length) {
    const message = left === 0 ? `${tier.name} is sold out` : `Only ${left} ticket(s) left in ${tier.name}`;
    throw new DomainError("SOLD_OUT", message, { seatsLeft: left });
  }

  // Every check has passed. Only now do we change anything.
  tier.sold += names.length;

  let reference;
  do {
    reference = newReference();
  } while (store.bookingsByReference.has(reference));

  const now = new Date().toISOString();
  const booking = {
    id: newId(),
    reference,
    bookedBy: booker,
    tierId,
    status: "pending",
    createdAt: now,
    amountInKobo: tier.priceInKobo * names.length,
    tickets: names.map((holderName) => ({
      id: newId(),
      holderName,
      priceInKobo: tier.priceInKobo,
      status: "valid",
      issuedAt: now,
      usedAt: null,
    })),
  };
  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(reference, booking);
  return booking;
}

export function findBookingByReference(store, reference) {
  return store.bookingsByReference.get(reference);
}

export function cancelBooking(store, reference) {
  const booking = findBookingByReference(store, reference);
  if (!booking) throw new DomainError("NOT_FOUND", "Booking not found");
  if (!HOLDS_SEATS.has(booking.status)) {
    throw new DomainError("INVALID_TRANSITION", `A ${booking.status} booking cannot be cancelled`);
  }
  getTier(store, booking.tierId).sold -= booking.tickets.length;
  booking.status = "cancelled";
  return booking;
}

export function joinWaitlist(store, tierId, bookedBy, holderNames) {
  const tier = getTier(store, tierId);
  const booker = requireText(bookedBy, "Booker");
  const names = requireHolderNames(holderNames);

  if (seatsLeft(tier) >= names.length) {
    throw new DomainError("NOT_SOLD_OUT", "Seats are available, so book them instead");
  }
  const queue = store.waitlists.get(tierId);
  queue.enqueue({ bookedBy: booker, holderNames: names });
  return { position: queue.size };
}

// Strict first-in-first-out: only the person at the front of the line is considered.
export function offerNextOnWaitlist(store, tierId) {
  const tier = getTier(store, tierId);
  const queue = store.waitlists.get(tierId);
  const head = queue.peek();
  if (!head || seatsLeft(tier) < head.holderNames.length) return undefined;
  return queue.dequeue();
}