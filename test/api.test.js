import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createApplication } from "../src/application.js";
import { createMockPaymentGateway } from "../src/lib/mockPaymentGateway.js";

describe("Build 4 REST API", () => {
  let server;
  let baseUrl;
  let declinePayment;
  let chargedAmounts;
  let refundRequests;

  beforeEach(async () => {
    declinePayment = false;
    chargedAmounts = [];
    refundRequests = [];
    const mockGateway = createMockPaymentGateway({
      shouldDecline: ({ amountInKobo }) => {
        chargedAmounts.push(amountInKobo);
        return declinePayment;
      },
    });
    const paymentGateway = {
      ...mockGateway,
      async refund(details) {
        refundRequests.push(details);
        return mockGateway.refund(details);
      },
    };
    ({ server } = createApplication({ paymentGateway }));
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    if (server?.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  async function request(path, { method = "GET", userId, body, rawBody } = {}) {
    const headers = {};
    if (userId !== undefined) headers["x-user-id"] = userId;
    if (body !== undefined || rawBody !== undefined) headers["content-type"] = "application/json";
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : undefined,
    };
  }

  async function createEvent({
    userId = "organizer-1",
    title = "Lagos Tech Meetup",
    city = "Lagos",
    startsAt = "2026-12-05T17:00:00Z",
  } = {}) {
    return request("/api/events", {
      method: "POST",
      userId,
      body: { title, city, venue: `${city} Hall`, startsAt },
    });
  }

  async function createPublishedEvent(options = {}) {
    const eventResponse = await createEvent(options);
    assert.equal(eventResponse.status, 201);
    const event = eventResponse.body;
    const tierResponse = await request(`/api/events/${event.id}/tiers`, {
      method: "POST",
      userId: options.userId ?? "organizer-1",
      body: {
        name: "General",
        priceInKobo: options.priceInKobo ?? 500000,
        capacity: options.capacity ?? 10,
      },
    });
    assert.equal(tierResponse.status, 201);
    const publishResponse = await request(`/api/events/${event.id}/publish`, {
      method: "POST",
      userId: options.userId ?? "organizer-1",
    });
    assert.equal(publishResponse.status, 200);
    return { event, tier: tierResponse.body };
  }

  async function createBooking(tierId, { userId = "attendee-1", tickets } = {}) {
    return request("/api/bookings", {
      method: "POST",
      userId,
      body: {
        tierId,
        tickets: tickets ?? [{ firstName: "Ada", lastName: "Obi" }],
      },
    });
  }

  it("creates draft events and requires an x-user-id", async () => {
    const missingUser = await request("/api/events", {
      method: "POST",
      body: { title: "Meetup", city: "Lagos", startsAt: "2026-12-05" },
    });
    assert.equal(missingUser.status, 400);
    assert.deepEqual(missingUser.body, {
      error: { code: "VALIDATION", message: "The x-user-id header is required" },
    });

    const response = await createEvent();
    assert.equal(response.status, 201);
    assert.ok(response.body.id);
    assert.equal(response.body.organizerId, "organizer-1");
    assert.equal(response.body.status, "draft");
    assert.deepEqual(response.body.tierIds, []);
  });

  it("rejects invalid event and tier input with the shared error shape", async () => {
    const invalidEvent = await createEvent({ title: " ", startsAt: "2026-02-30" });
    assert.equal(invalidEvent.status, 400);
    assert.equal(invalidEvent.body.error.code, "VALIDATION");
    assert.deepEqual(Object.keys(invalidEvent.body), ["error"]);
    assert.deepEqual(Object.keys(invalidEvent.body.error).sort(), ["code", "message"]);

    const invalidDate = await createEvent({ startsAt: "2026-02-30" });
    assert.equal(invalidDate.status, 400);
    assert.equal(invalidDate.body.error.code, "VALIDATION");

    const invalidCity = await createEvent({ city: " " });
    assert.equal(invalidCity.status, 400);
    assert.equal(invalidCity.body.error.code, "VALIDATION");
    assert.deepEqual((await request("/api/events")).body, []);

    const event = (await createEvent()).body;
    const invalidTier = await request(`/api/events/${event.id}/tiers`, {
      method: "POST",
      userId: "organizer-1",
      body: { name: "General", priceInKobo: 12.5, capacity: 10 },
    });
    assert.equal(invalidTier.status, 400);
    assert.equal(invalidTier.body.error.code, "VALIDATION");

    const invalidCapacity = await request(`/api/events/${event.id}/tiers`, {
      method: "POST",
      userId: "organizer-1",
      body: { name: "General", priceInKobo: 500000, capacity: 0 },
    });
    assert.equal(invalidCapacity.status, 400);
    assert.equal(invalidCapacity.body.error.code, "VALIDATION");

    const missingEvent = await request("/api/events/missing-event/tiers", {
      method: "POST",
      userId: "organizer-1",
      body: { name: "General", priceInKobo: 500000, capacity: 10 },
    });
    assert.equal(missingEvent.status, 404);
    assert.equal(missingEvent.body.error.code, "NOT_FOUND");
  });

  it("allows only the organizer to add tiers, publish, and unpublish", async () => {
    const draftResponse = await createEvent();
    const draft = draftResponse.body;
    const outsiderTier = await request(`/api/events/${draft.id}/tiers`, {
      method: "POST",
      userId: "organizer-2",
      body: { name: "General", priceInKobo: 500000, capacity: 10 },
    });
    assert.equal(outsiderTier.status, 403);
    assert.equal(outsiderTier.body.error.code, "FORBIDDEN");

    const outsiderPublishDraft = await request(`/api/events/${draft.id}/publish`, {
      method: "POST",
      userId: "organizer-2",
    });
    assert.equal(outsiderPublishDraft.status, 403);
    assert.equal(outsiderPublishDraft.body.error.code, "FORBIDDEN");

    const { event, tier } = await createPublishedEvent();

    const outsiderUnpublish = await request(`/api/events/${event.id}/unpublish`, {
      method: "POST",
      userId: "organizer-2",
    });
    assert.equal(outsiderUnpublish.status, 403);
    assert.equal(outsiderUnpublish.body.error.code, "FORBIDDEN");

    const unpublish = await request(`/api/events/${event.id}/unpublish`, {
      method: "POST",
      userId: "organizer-1",
    });
    assert.equal(unpublish.status, 200);
    assert.equal(unpublish.body.status, "draft");
    assert.deepEqual((await request("/api/events")).body, []);

    const republish = await request(`/api/events/${event.id}/publish`, {
      method: "POST",
      userId: "organizer-1",
    });
    assert.equal(republish.status, 200);
    assert.equal(republish.body.status, "published");
    assert.equal(tier.eventId, event.id);
  });

  it("rejects publishing an event without a tier", async () => {
    const { body: event } = await createEvent();
    const response = await request(`/api/events/${event.id}/publish`, {
      method: "POST",
      userId: "organizer-1",
    });
    assert.equal(response.status, 409);
    assert.equal(response.body.error.code, "INVALID_STATE");
  });

  it("searches only published events and applies query filters and sorting", async () => {
    await createPublishedEvent({
      title: "Lagos Jazz Night",
      city: "Lagos",
      startsAt: "2026-12-05T17:00:00Z",
      priceInKobo: 250000,
      capacity: 3,
    });
    await createPublishedEvent({
      title: "Lagos Tech Meetup",
      city: "Lagos",
      startsAt: "2026-12-04T17:00:00Z",
      priceInKobo: 500000,
      capacity: 5,
    });
    const { tier: soldOutTier } = await createPublishedEvent({
      title: "Abuja Tech Meetup",
      city: "Abuja",
      startsAt: "2026-12-06T17:00:00Z",
      priceInKobo: 400000,
      capacity: 2,
    });
    const soldOutBooking = await createBooking(soldOutTier.id, {
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
      ],
    });
    assert.equal(soldOutBooking.status, 201);
    const event = (await createEvent({ title: "Hidden Lagos Jazz", city: "Lagos" })).body;

    const search = await request(
      "/api/events?q=JAZZ&city=lagos&from=2026-12-05&to=2026-12-05&maxPriceInKobo=250000&sortBy=price",
    );
    assert.equal(search.status, 200);
    assert.deepEqual(search.body.map((item) => item.title), ["Lagos Jazz Night"]);

    const priceSorted = await request("/api/events?city=lagos&sortBy=price");
    assert.deepEqual(
      priceSorted.body.map(({ title }) => title),
      ["Lagos Jazz Night", "Lagos Tech Meetup"],
    );

    const dateSorted = await request("/api/events?sortBy=date");
    assert.deepEqual(
      dateSorted.body.map(({ title }) => title),
      ["Lagos Tech Meetup", "Lagos Jazz Night", "Abuja Tech Meetup"],
    );

    const availableByCapacity = await request("/api/events?onlyAvailable=true&sortBy=availability");
    assert.deepEqual(
      availableByCapacity.body.map(({ title }) => title),
      ["Lagos Tech Meetup", "Lagos Jazz Night"],
    );

    const unfiltered = await request("/api/events");
    assert.equal(unfiltered.body.length, 3);
    assert.ok(!unfiltered.body.some((item) => item.id === event.id));
  });

  it("returns validation errors for malformed search query parameters", async () => {
    for (const path of [
      "/api/events?maxPriceInKobo=1.5",
      "/api/events?onlyAvailable=maybe",
      "/api/events?from=2026-02-30",
      "/api/events?sortBy=popularity",
    ]) {
      const response = await request(path);
      assert.equal(response.status, 400);
      assert.equal(response.body.error.code, "VALIDATION");
    }
  });

  it("books named attendees as separate tickets with their own IDs and kobo totals", async () => {
    const { tier } = await createPublishedEvent({ capacity: 3, priceInKobo: 500000 });
    const response = await createBooking(tier.id, {
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
      ],
    });

    assert.equal(response.status, 201);
    assert.ok(response.body.id);
    assert.ok(response.body.reference);
    assert.equal(response.body.status, "pending");
    assert.equal(response.body.amountInKobo, 1000000);
    assert.deepEqual(
      response.body.tickets.map(({ firstName, lastName, id }) => ({ firstName, lastName, id: Boolean(id) })),
      [
        { firstName: "Ada", lastName: "Obi", id: true },
        { firstName: "Tunde", lastName: "Bello", id: true },
      ],
    );

    const events = await request("/api/events");
    assert.equal(events.body[0].seatsLeft, 1);
  });

  it("rejects invalid attendee names and sold-out bookings without changing availability", async () => {
    const { tier } = await createPublishedEvent({ capacity: 1 });
    for (const tickets of [
      [],
      -1,
      1.5,
      Array(11).fill({ firstName: "Guest", lastName: "Example" }),
      [{ firstName: "Ada", lastName: " " }],
    ]) {
      const invalid = await createBooking(tier.id, { tickets });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.error.code, "VALIDATION");
    }

    const booked = await createBooking(tier.id);
    assert.equal(booked.status, 201);
    const soldOut = await createBooking(tier.id);
    assert.equal(soldOut.status, 409);
    assert.equal(soldOut.body.error.code, "SOLD_OUT");
    assert.equal((await request("/api/events")).body[0].seatsLeft, 0);
  });

  it("declined mock payment leaves the booking pending and can be retried", async () => {
    const { tier } = await createPublishedEvent({ priceInKobo: 750000 });
    const bookingResponse = await createBooking(tier.id, {
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
      ],
    });
    const { reference, amountInKobo } = bookingResponse.body;
    declinePayment = true;

    const declined = await request(`/api/bookings/${reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(declined.status, 402);
    assert.equal(declined.body.error.code, "PAYMENT_DECLINED");
    assert.equal((await request("/api/events")).body[0].seatsLeft, 8);

    declinePayment = false;
    const paid = await request(`/api/bookings/${reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, "paid");
    assert.equal(paid.body.amountInKobo, amountInKobo);
    assert.deepEqual(chargedAmounts, [amountInKobo, amountInKobo]);
  });

  it("allows only the booking owner to pay and prevents charging twice", async () => {
    const { tier } = await createPublishedEvent();
    const booking = (await createBooking(tier.id)).body;

    const outsider = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-2",
    });
    assert.equal(outsider.status, 403);
    assert.equal(outsider.body.error.code, "FORBIDDEN");
    assert.deepEqual(chargedAmounts, []);

    const paid = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(paid.status, 200);

    const duplicate = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "INVALID_TRANSITION");
    assert.deepEqual(chargedAmounts, [booking.amountInKobo]);
  });

  it("refunds one paid ticket, releases one seat, and keeps sibling tickets valid", async () => {
    const { tier } = await createPublishedEvent({ capacity: 3, priceInKobo: 500000 });
    const booking = (await createBooking(tier.id, {
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
        { firstName: "Chioma", lastName: "Eze" },
      ],
    })).body;
    assert.equal(booking.amountInKobo, 1500000);

    const paid = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(paid.status, 200);
    assert.equal((await request("/api/events")).body[0].seatsLeft, 0);

    const ticketToRefund = booking.tickets[1];
    const outsider = await request(
      `/api/bookings/${booking.reference}/tickets/${ticketToRefund.id}/refund`,
      { method: "POST", userId: "attendee-2" },
    );
    assert.equal(outsider.status, 403);
    assert.equal(outsider.body.error.code, "FORBIDDEN");
    assert.deepEqual(refundRequests, []);

    const refunded = await request(
      `/api/bookings/${booking.reference}/tickets/${ticketToRefund.id}/refund`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(refunded.status, 200);
    assert.equal(refunded.body.status, "paid");
    assert.equal(refunded.body.refundedAmountInKobo, 500000);
    assert.equal(refunded.body.tickets[1].status, "refunded");
    assert.ok(refunded.body.tickets[1].refundedAt);
    assert.deepEqual(
      refunded.body.tickets.map((ticket) => ticket.status),
      ["valid", "refunded", "valid"],
    );
    assert.equal((await request("/api/events")).body[0].seatsLeft, 1);
    assert.deepEqual(refundRequests, [{
      amountInKobo: 500000,
      bookingReference: booking.reference,
      ticketId: ticketToRefund.id,
    }]);

    const duplicate = await request(
      `/api/bookings/${booking.reference}/tickets/${ticketToRefund.id}/refund`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "INVALID_TRANSITION");
    assert.equal((await request("/api/events")).body[0].seatsLeft, 1);
    assert.equal(refundRequests.length, 1);
  });

  it("rejects refunds for unpaid bookings and tickets outside the booking", async () => {
    const { tier } = await createPublishedEvent();
    const booking = (await createBooking(tier.id)).body;

    const unpaid = await request(
      `/api/bookings/${booking.reference}/tickets/${booking.tickets[0].id}/refund`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(unpaid.status, 409);
    assert.equal(unpaid.body.error.code, "INVALID_TRANSITION");

    const paid = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(paid.status, 200);

    const missingTicket = await request(
      `/api/bookings/${booking.reference}/tickets/not-in-this-booking/refund`,
      { method: "POST", userId: "attendee-1" },
    );
    assert.equal(missingTicket.status, 404);
    assert.equal(missingTicket.body.error.code, "NOT_FOUND");
    assert.deepEqual(refundRequests, []);
  });

  it("cancels only the owner's pending booking and releases its seats", async () => {
    const { tier } = await createPublishedEvent({ capacity: 2 });
    const booking = (await createBooking(tier.id, {
      tickets: [
        { firstName: "Ada", lastName: "Obi" },
        { firstName: "Tunde", lastName: "Bello" },
      ],
    })).body;

    const outsider = await request(`/api/bookings/${booking.reference}/cancel`, {
      method: "POST",
      userId: "attendee-2",
    });
    assert.equal(outsider.status, 403);

    const cancelled = await request(`/api/bookings/${booking.reference}/cancel`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.status, "cancelled");
    assert.deepEqual(cancelled.body.tickets.map((ticket) => ticket.status), ["cancelled", "cancelled"]);
    assert.equal((await request("/api/events")).body[0].seatsLeft, 2);

    const payCancelled = await request(`/api/bookings/${booking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(payCancelled.status, 409);
    assert.equal(payCancelled.body.error.code, "INVALID_TRANSITION");

    const paidBooking = (await createBooking(tier.id)).body;
    await request(`/api/bookings/${paidBooking.reference}/pay`, {
      method: "POST",
      userId: "attendee-1",
    });
    const cancelPaid = await request(`/api/bookings/${paidBooking.reference}/cancel`, {
      method: "POST",
      userId: "attendee-1",
    });
    assert.equal(cancelPaid.status, 409);
    assert.equal(cancelPaid.body.error.code, "INVALID_TRANSITION");
  });
});
