import { mockEvents } from "./mockData.js";

const NETWORK_DELAY_MS = 120;
const HOLD_SECONDS = 10 * 60;
const SUCCESS_PAYMENT_TOKEN = "mock-card-approved";

const events = structuredClone(mockEvents);
const bookings = new Map();
let bookingSequence = 0;
let ticketSequence = 0;

function wait() {
  return new Promise((resolve) => setTimeout(resolve, NETWORK_DELAY_MS));
}

function apiError(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function copy(value) {
  return structuredClone(value);
}

function minimumPrice(event) {
  return Math.min(...event.tiers.map((item) => item.priceInKobo));
}

function seatsAvailable(event) {
  return event.tiers.reduce((total, item) => total + item.seatsLeft, 0);
}

function releaseExpiredBookings() {
  const now = Date.now();
  for (const booking of bookings.values()) {
    if (booking.status !== "pending" || Date.parse(booking.holdUntil) > now) continue;
    const tier = events.flatMap((event) => event.tiers)
      .find((item) => item.id === booking.tierId);
    if (tier) {
      tier.sold -= booking.tickets.length;
      tier.seatsLeft += booking.tickets.length;
    }
    booking.status = "expired";
  }
}

export async function listEvents({
  q = "",
  city = "",
  from,
  to,
  maxPriceInKobo,
  onlyAvailable = false,
  sort = "date",
} = {}) {
  await wait();
  releaseExpiredBookings();
  const needle = q.trim().toLowerCase();
  let result = events.filter((event) => event.status === "published");
  if (needle) {
    result = result.filter((event) =>
      `${event.title} ${event.venue}`.toLowerCase().includes(needle));
  }
  if (city) {
    result = result.filter((event) => event.city.toLowerCase() === city.toLowerCase());
  }
  if (from) {
    const fromTime = Date.parse(`${from}T00:00:00.000Z`);
    result = result.filter((event) => Date.parse(event.startsAt) >= fromTime);
  }
  if (to) {
    const toTime = Date.parse(`${to}T23:59:59.999Z`);
    result = result.filter((event) => Date.parse(event.startsAt) <= toTime);
  }
  if (maxPriceInKobo !== undefined) {
    result = result.filter((event) => minimumPrice(event) <= maxPriceInKobo);
  }
  if (onlyAvailable) result = result.filter((event) => seatsAvailable(event) > 0);

  const sorters = {
    date: (first, second) =>
      Date.parse(first.startsAt) - Date.parse(second.startsAt)
      || first.title.localeCompare(second.title),
    price: (first, second) =>
      minimumPrice(first) - minimumPrice(second)
      || first.title.localeCompare(second.title),
    availability: (first, second) =>
      seatsAvailable(second) - seatsAvailable(first)
      || first.title.localeCompare(second.title),
  };
  if (!Object.hasOwn(sorters, sort)) {
    throw apiError(400, "VALIDATION", `Unknown sort option: ${sort}`);
  }
  return { events: copy([...result].sort(sorters[sort])) };
}

export async function getEvent(eventId) {
  await wait();
  releaseExpiredBookings();
  const event = events.find((item) =>
    item.id === eventId && item.status === "published");
  if (!event) throw apiError(404, "NOT_FOUND", "Event not found");
  return { event: copy(event) };
}

export async function createBooking({ tierId, tickets }) {
  await wait();
  releaseExpiredBookings();
  if (!Array.isArray(tickets) || tickets.length < 1 || tickets.length > 10) {
    throw apiError(400, "VALIDATION", "Provide between 1 and 10 named tickets");
  }
  const attendees = tickets.map((ticket) => {
    if (
      !ticket
      || typeof ticket.firstName !== "string"
      || !ticket.firstName.trim()
      || typeof ticket.lastName !== "string"
      || !ticket.lastName.trim()
    ) {
      throw apiError(400, "VALIDATION", "Every ticket needs a first and last name");
    }
    const firstName = ticket.firstName.trim();
    const lastName = ticket.lastName.trim();
    return { firstName, lastName, holderName: `${firstName} ${lastName}` };
  });

  const event = events.find((item) => item.status === "published"
    && item.tiers.some((tier) => tier.id === tierId));
  const selectedTier = event?.tiers.find((tier) => tier.id === tierId);
  if (!selectedTier) throw apiError(404, "NOT_FOUND", "Ticket tier not found");
  if (attendees.length > selectedTier.seatsLeft) {
    throw apiError(409, "SOLD_OUT", `Only ${selectedTier.seatsLeft} ticket(s) left in ${selectedTier.name}`);
  }

  selectedTier.sold += attendees.length;
  selectedTier.seatsLeft -= attendees.length;
  bookingSequence += 1;
  const createdAt = new Date();
  const holdUntil = new Date(createdAt.getTime() + HOLD_SECONDS * 1000);
  const ticketsWithIds = attendees.map((attendee) => {
    ticketSequence += 1;
    return {
      id: `mock-ticket-${String(ticketSequence).padStart(5, "0")}`,
      ...attendee,
      priceInKobo: selectedTier.priceInKobo,
      status: "valid",
    };
  });
  const booking = {
    id: `mock-booking-${String(bookingSequence).padStart(5, "0")}`,
    reference: `MOCK-${String(bookingSequence).padStart(4, "0")}`,
    eventId: event.id,
    tierId: selectedTier.id,
    status: "pending",
    amountInKobo: selectedTier.priceInKobo * attendees.length,
    tickets: ticketsWithIds,
    createdAt: createdAt.toISOString(),
    holdUntil: holdUntil.toISOString(),
  };
  bookings.set(booking.reference, booking);
  return copy(booking);
}

export async function pay(reference, paymentToken) {
  await wait();
  releaseExpiredBookings();
  const booking = bookings.get(reference);
  if (!booking) throw apiError(404, "NOT_FOUND", "Booking not found");
  if (booking.status === "expired") {
    throw apiError(409, "INVALID_TRANSITION", "The ticket hold has expired");
  }
  if (booking.status === "paid") return copy(booking);
  if (paymentToken !== SUCCESS_PAYMENT_TOKEN) {
    throw apiError(402, "PAYMENT_DECLINED", "Mock payment was declined");
  }
  booking.status = "paid";
  booking.paidAt = new Date().toISOString();
  return copy(booking);
}
