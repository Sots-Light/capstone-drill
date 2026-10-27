import { DomainError } from "../domain/errors.js";
import { createRouter } from "./router.js";

function requireUserId(request) {
  const userId = request.headers["x-user-id"];
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new DomainError("VALIDATION", "The x-user-id header is required");
  }
  return userId.trim();
}

function parseBoolean(value, field) {
  if (value === undefined) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new DomainError("VALIDATION", `${field} must be true or false`);
}

function parsePrice(value) {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new DomainError("VALIDATION", "maxPriceInKobo must be a whole number");
  }
  const price = Number(value);
  if (!Number.isSafeInteger(price)) {
    throw new DomainError("VALIDATION", "maxPriceInKobo must be a whole number");
  }
  return price;
}

function eventCriteria(searchParams) {
  const criteria = {};
  for (const key of ["q", "city", "from", "to"]) {
    if (searchParams.has(key)) criteria[key] = searchParams.get(key);
  }
  const maxPriceInKobo = parsePrice(searchParams.get("maxPriceInKobo") ?? undefined);
  if (maxPriceInKobo !== undefined) criteria.maxPriceInKobo = maxPriceInKobo;
  const onlyAvailable = parseBoolean(searchParams.get("onlyAvailable") ?? undefined, "onlyAvailable");
  if (onlyAvailable !== undefined) criteria.onlyAvailable = onlyAvailable;
  return criteria;
}

export function createApiRouter({ eventService, bookingService }) {
  const router = createRouter();

  router.add("POST", "/api/events", async ({ request }) => ({
    statusCode: 201,
    body: await eventService.createEvent(requireUserId(request), request.body),
  }));

  router.add("POST", "/api/events/:id/tiers", async ({ request, params }) => ({
    statusCode: 201,
    body: await eventService.addTier(requireUserId(request), params.id, request.body),
  }));

  router.add("POST", "/api/events/:id/publish", async ({ request, params }) => ({
    body: await eventService.publishEvent(requireUserId(request), params.id),
  }));

  router.add("POST", "/api/events/:id/unpublish", async ({ request, params }) => ({
    body: await eventService.unpublishEvent(requireUserId(request), params.id),
  }));

  router.add("GET", "/api/events", async ({ searchParams }) => ({
    body: await eventService.searchEvents(
      eventCriteria(searchParams),
      searchParams.get("sortBy") ?? "date",
    ),
  }));

  router.add("POST", "/api/bookings", async ({ request }) => ({
    statusCode: 201,
    body: await bookingService.createBooking(requireUserId(request), request.body),
  }));

  router.add("POST", "/api/bookings/:reference/pay", async ({ request, params }) => ({
    body: await bookingService.payForBooking(requireUserId(request), params.reference),
  }));

  router.add("POST", "/api/bookings/:reference/tickets/:ticketId/refund", async ({ request, params }) => ({
    body: await bookingService.refundTicket(
      requireUserId(request),
      params.reference,
      params.ticketId,
    ),
  }));

  router.add("POST", "/api/bookings/:reference/cancel", async ({ request, params }) => ({
    body: await bookingService.cancelBooking(requireUserId(request), params.reference),
  }));

  return router;
}
